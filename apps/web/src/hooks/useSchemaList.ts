import {
  DataSourceColumn,
  DataSourceSchema,
  DataSourceTable,
} from '@briefer/types'
import { Map, Set, List } from 'immutable'
import { distance as levenshtein } from 'fastest-levenshtein'
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
  openItems: Set<string>
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

      if (!openItems.has(schemaName)) {
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

          if (!openItems.has(`${schemaName}.${tableName}`)) {
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
  const [data, setData] = useState<SchemaList>(() =>
    flattenSchemas(schemas, openItems)
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
      setData(flattenSchemas(schemas, openItems))
      return
    }

    let active = true
    setSearching(true)

    const result: SchemaItem[] = []
    const addedTables = Set<string>()
    const addedSchemas = Set<string>()

    const workQueue: {
      schema: DataSourceSchema
      schemaName: string
      table: DataSourceTable
      tableName: string
      column: DataSourceColumn
    }[] = []
    schemas.forEach((schema, schemaName) => {
      Object.entries(schema.tables).forEach(([tableName, table]) => {
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
          setData(List(result))
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
            .includes(search.trim().toLowerCase()) ||
          levenshtein(
            search.trim().toLowerCase(),
            fullColumnName.trim().toLowerCase()
          ) <=
            fullColumnName.length / 2
        ) {
          if (!addedSchemas.has(work.schemaName)) {
            result.push({
              _tag: 'schema',
              name: work.schemaName,
              schema: work.schema,
              isOpen: true,
            })
            addedSchemas.add(work.schemaName)
          }

          if (!addedTables.has(`${work.schemaName}.${work.tableName}`)) {
            result.push({
              _tag: 'table',
              schemaName: work.schemaName,
              name: work.tableName,
              table: work.table,
              isOpen: true,
            })
            addedTables.add(`${work.schemaName}.${work.tableName}`)
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
      setData(List(result))
      setSearching(false)
    })

    return () => {
      active = false
    }
  }, [schemas, search])

  useEffect(() => {
    setData(flattenSchemas(schemas, openItems))
  }, [schemas, openItems])

  return useMemo(() => [state, api], [state, api])
}

export default useSchemaList
