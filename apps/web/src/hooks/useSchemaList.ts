import {
  DataSourceColumn,
  DataSourceSchema,
  DataSourceTable,
} from '@briefer/types'
import { Map, Set, List } from 'immutable'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type SchemaItem =
  | {
      _tag: 'column'
      schemaName: string
      tableName: string
      column: DataSourceColumn
    }
  | {
      _tag: 'table'
      schemaName: string
      name: string
      table: DataSourceTable
      isOpen: boolean
    }
  | {
      _tag: 'schema'
      name: string
      schema: DataSourceSchema
      isOpen: boolean
    }

type SchemaList = List<SchemaItem>

function flattenSchemas(
  schemas: Map<string, DataSourceSchema>,
  openItems: Set<string>,
  filterOpenItems = false
): SchemaList {
  const result: SchemaItem[] = []

  schemas
    .sortBy((_, key) => key)
    .forEach((schema, schemaName) => {
      result.push({
        _tag: 'schema',
        name: schemaName,
        schema,
        isOpen: openItems.has(schemaName),
      })

      if (filterOpenItems && !openItems.has(schemaName)) {
        return
      }

      Object.entries(schema.tables)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([tableName, table]) => {
          result.push({
            _tag: 'table',
            schemaName,
            name: tableName,
            table,
            isOpen: openItems.has(`${schemaName}.${tableName}`),
          })

          if (filterOpenItems && !openItems.has(`${schemaName}.${tableName}`)) {
            return
          }

          table.columns
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((column) => {
              result.push({
                _tag: 'column',
                schemaName,
                tableName,
                column,
              })
            })
        })
    })

  return List(result)
}

interface State {
  search: string
  searching: boolean
  schemaList: SchemaList
}

interface API {
  setSearch: (search: string) => void
  toggleSchema: (schemaName: string) => void
  toggleTable: (schemaName: string, tableName: string) => void
}

type UseSchemaList = [State, API]

function useSchemaList(schemas: Map<string, DataSourceSchema>): UseSchemaList {
  const [openItems, setOpenItems] = useState<Set<string>>(Set())
  const [search, setSearch] = useState<string>('')
  const [searching, setSearching] = useState<boolean>(false)

  const [filteredItems, setFilteredItems] = useState<SchemaList>(() =>
    flattenSchemas(schemas, openItems)
  )

  const [data, setData] = useState<SchemaList>(() =>
    flattenSchemas(schemas, openItems, true)
  )

  const toggleSchema = useCallback((schemaName: string) => {
    setOpenItems((openItems) => {
      if (openItems.has(schemaName)) {
        return openItems.delete(schemaName)
      }

      return openItems.add(schemaName)
    })
  }, [])

  const toggleTable = useCallback((schemaName: string, tableName: string) => {
    const key = `${schemaName}.${tableName}`
    setOpenItems((openItems) => {
      if (openItems.has(key)) {
        return openItems.delete(key)
      }

      return openItems.add(key).add(schemaName)
    })
  }, [])

  const api = useMemo<API>(
    () => ({
      setSearch,
      toggleSchema,
      toggleTable,
    }),
    [setSearch, toggleSchema, toggleTable]
  )

  const state = useMemo<State>(
    () => ({
      search,
      searching,
      schemaList: data,
    }),
    [search, searching, data]
  )

  useEffect(() => {
    const searchTerm = search.trim().toLowerCase()
    if (searchTerm === '') {
      setSearching(false)
      const flattenedSchemas = flattenSchemas(schemas, openItems)
      setFilteredItems(flattenedSchemas)
      setData(flattenedSchemas)
      return
    }

    let active = true
    setSearching(true)

    const result: SchemaItem[] = []
    let addedTables = Set<string>()
    let addedSchemas = Set<string>()

    const workQueue: {
      schema: DataSourceSchema
      schemaName: string
      table: DataSourceTable
      tableName: string
      column: DataSourceColumn
    }[] = []
    Array.from(schemas.entries())
      .sort(([a], [b]) => {
        const schemaTerm = searchTerm.split('.')[0]

        // compute how many characters are left after removing the search term
        // the one that has less characters left should be prioritized
        const aDiff = a.replace(schemaTerm, '').length
        const bDiff = b.replace(schemaTerm, '').length

        const diff = aDiff - bDiff
        if (diff === 0) {
          return a.localeCompare(b)
        } else if (diff < 0) {
          return -1
        } else {
          return 1
        }
      })
      .forEach(([schemaName, schema]) => {
        Object.entries(schema.tables)
          .sort(([a], [b]) => {
            const searchTerms = searchTerm.split('.')
            let tableTerm = searchTerms[0]
            if (searchTerms.length > 1 && schemaName.includes(searchTerms[0])) {
              tableTerm = searchTerms[1]
            }

            const aDiff = a.replace(tableTerm, '').length
            const bDiff = b.replace(tableTerm, '').length

            const diff = aDiff - bDiff
            if (diff === 0) {
              return a.localeCompare(b)
            } else if (diff < 0) {
              return -1
            } else {
              return 1
            }
          })
          .forEach(([tableName, table]) => {
            table.columns.forEach((column) => {
              workQueue.push({
                schema,
                schemaName,
                table,
                tableName,
                column,
              })
            })
          })
      })

    Promise.resolve().then(async () => {
      if (!active) {
        return
      }

      let startTime = Date.now()
      let remaining = workQueue.length
      for (const work of workQueue) {
        const FPS = 60
        if (Date.now() - startTime > 1000 / FPS) {
          const resultsList = List(result)
          setFilteredItems(resultsList)
          setData(resultsList)
          await new Promise((resolve) => requestAnimationFrame(resolve))
          if (!active) {
            return
          }

          startTime = Date.now()
        }

        const fullColumnName = `${work.schemaName}.${work.tableName}.${work.column.name}`
        if (
          search.trim() === '' ||
          fullColumnName
            .trim()
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        ) {
          if (!addedSchemas.has(work.schemaName)) {
            result.push({
              _tag: 'schema',
              name: work.schemaName,
              schema: work.schema,
              isOpen: true,
            })
            addedSchemas = addedSchemas.add(work.schemaName)
          }

          if (!addedTables.has(`${work.schemaName}.${work.tableName}`)) {
            result.push({
              _tag: 'table',
              schemaName: work.schemaName,
              name: work.tableName,
              table: work.table,
              isOpen: true,
            })
            addedTables = addedTables.add(
              `${work.schemaName}.${work.tableName}`
            )
          }

          result.push({
            _tag: 'column',
            schemaName: work.schemaName,
            tableName: work.tableName,
            column: work.column,
          })
        }
        remaining--
      }
      const resultsList = List(result)
      setData(resultsList)
      setFilteredItems(resultsList)
      setSearching(false)
      setOpenItems(addedSchemas.union(addedTables))
    })

    return () => {
      active = false
    }
  }, [schemas, search])

  useEffect(() => {
    setData(
      filteredItems
        .filter((item) => {
          if (item._tag === 'schema') {
            return true
          }

          if (item._tag === 'table') {
            return openItems.has(item.schemaName)
          }

          return (
            openItems.has(item.schemaName) &&
            openItems.has(`${item.schemaName}.${item.tableName}`)
          )
        })
        .map((item) => {
          if (item._tag === 'schema') {
            return {
              ...item,
              isOpen: openItems.has(item.name),
            }
          }

          if (item._tag === 'table') {
            return {
              ...item,
              isOpen: openItems.has(`${item.schemaName}.${item.name}`),
            }
          }

          return item
        })
    )
  }, [schemas, openItems, filteredItems])

  return useMemo(() => [state, api], [state, api])
}

export default useSchemaList
