import { Map } from 'immutable'
import { Extension } from '@codemirror/state'
import { LanguageSupport } from '@codemirror/language'
import { useDataSources } from '@/hooks/useDatasources'
import {
  keywordCompletionSource,
  MSSQL,
  MySQL,
  PostgreSQL,
  schemaCompletionSource,
  SQLDialect,
  SQLNamespace,
  StandardSQL,
} from '@codemirror/lang-sql'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { DataSourceSchema } from '@briefer/types'
import { APIDataSource } from '@briefer/database'

function getDialect(type?: APIDataSource['config']['type']): SQLDialect {
  if (!type) {
    return StandardSQL
  }

  switch (type) {
    case 'bigquery':
    case 'snowflake':
    case 'oracle':
    case 'trino':
    case 'athena':
    case 'databrickssql':
      return StandardSQL
    case 'mysql':
      return MySQL
    case 'psql':
    case 'redshift':
      return PostgreSQL
    case 'sqlserver':
      return MSSQL
  }
}

async function computeCompletion(
  dataSource: APIDataSource,
  schemas: Map<string, DataSourceSchema>
) {
  const schema = getSchemaFromSchemas(schemas)
  return schemaCompletionSource({
    dialect: getDialect(dataSource.config.type),
    schema,
    defaultSchema:
      'defaultSchema' in dataSource.structure
        ? dataSource.structure.defaultSchema
        : '',
  })
}

function adjustCasing(currentWord: string, suggestion: string): string {
  // Check if the current word is all uppercase
  if (currentWord === currentWord.toUpperCase()) {
    return suggestion.toUpperCase()
  }

  // Check if the current word is all lowercase
  if (currentWord === currentWord.toLowerCase()) {
    return suggestion.toLowerCase()
  }

  // Check if the current word is in title case (first letter uppercase, rest lowercase)
  if (
    currentWord[0] === currentWord[0].toUpperCase() &&
    currentWord.slice(1) === currentWord.slice(1).toLowerCase()
  ) {
    return suggestion[0].toUpperCase() + suggestion.slice(1).toLowerCase()
  }

  // if last character is uppercase, make the suggestion uppercase
  if (
    currentWord[currentWord.length - 1] ===
    currentWord[currentWord.length - 1].toUpperCase()
  ) {
    return suggestion.toUpperCase()
  }

  // if last character is lowercase, make the suggestion lowercase
  if (
    currentWord[currentWord.length - 1] ===
    currentWord[currentWord.length - 1].toLowerCase()
  ) {
    return suggestion.toLowerCase()
  }

  return suggestion
}

function getSchemaFromSchemas(
  schemas: Map<string, DataSourceSchema>
): SQLNamespace {
  const namespace: SQLNamespace = {}
  for (const [schemaName, schema] of Array.from(schemas.entries())) {
    for (const [tableName, table] of Object.entries(schema.tables)) {
      namespace[`${schemaName}.${tableName}`] = table.columns.map(
        (column) => column.name
      )
    }
  }

  return namespace
}

function language(
  dataSource: APIDataSource | null,
  schemas: Map<string, DataSourceSchema>
): Extension {
  const dialect = getDialect(dataSource?.config.type)

  const keywordSource = keywordCompletionSource(dialect, true)
  const keywordCompletion = async (
    context: CompletionContext
  ): Promise<CompletionResult | null> => {
    const wordRange = context.state.wordAt(context.pos)
    const word = wordRange
      ? context.state.sliceDoc(wordRange.from, wordRange.to)
      : ''
    const completions = await keywordSource(context)
    if (!completions) {
      return null
    }

    return {
      ...completions,
      options: completions.options.map((option) => ({
        ...option,
        label: adjustCasing(word, option.label),
      })),
    }
  }

  if (!dataSource) {
    return new LanguageSupport(dialect.language, [
      dialect.language.data.of({
        autocomplete: keywordCompletion,
      }),
    ])
  }

  const completionSource = computeCompletion(dataSource, schemas)
  const schemaCompletion = async (
    context: CompletionContext
  ): Promise<CompletionResult | null> => (await completionSource)(context)

  return new LanguageSupport(dialect.language, [
    dialect.language.data.of({
      autocomplete: keywordCompletion,
    }),
    dialect.language.data.of({
      autocomplete: schemaCompletion,
    }),
  ])
}

export function useSQLExtension(
  workspaceId: string,
  dataSourceId: string | null
): Extension {
  const getExtension = useContext(Context)

  // State to store the extension
  const [extension, setExtension] = useState<Extension>(() =>
    getExtension(workspaceId, dataSourceId)
  )

  // Refs to track previous workspaceId and dataSourceId
  const prevWorkspaceId = useRef(workspaceId)
  const prevDataSourceId = useRef(dataSourceId)

  useEffect(() => {
    // Only call getExtension if workspaceId or dataSourceId has changed
    if (
      prevWorkspaceId.current !== workspaceId ||
      prevDataSourceId.current !== dataSourceId
    ) {
      const newExtension = getExtension(workspaceId, dataSourceId)
      setExtension(newExtension)
      prevWorkspaceId.current = workspaceId
      prevDataSourceId.current = dataSourceId
    }
  }, [workspaceId, dataSourceId])

  return extension
}

const Context = createContext(
  (_workspaceId: string, _dataSourceId: string | null): Extension => {
    throw new Error('Called getExtension outside of provider')
  }
)

interface Props {
  workspaceId: string
  children: React.ReactNode
}
export function SQLExtensionProvider(props: Props) {
  const [{ datasources, schemas }] = useDataSources(props.workspaceId)
  const [extensions, setExtensions] = useState<Map<string, Extension>>(Map())

  const getExtension = useCallback(
    (workspaceId: string, dataSourceId: string | null): Extension => {
      const key = `${workspaceId}-${dataSourceId}`
      const extension = extensions.get(key)
      if (extension) {
        return extension
      }

      const datasource =
        datasources?.find((ds) => ds.config.data.id === dataSourceId) ?? null
      const schema = dataSourceId ? schemas.get(dataSourceId) : null
      const newExtension = language(datasource, schema ?? Map())

      setExtensions((extensions) => extensions.set(key, newExtension))

      return newExtension
    },
    [extensions, datasources, schemas]
  )

  const lastUpdate = useRef(0)
  useEffect(() => {
    const update = () => {
      setExtensions((extensions) =>
        extensions.map((_, key) => {
          const [, dataSourceId] = key.split('-')
          const datasource =
            datasources?.find((ds) => ds.config.data.id === dataSourceId) ??
            null
          const schema = dataSourceId ? schemas.get(dataSourceId) : null
          return language(datasource, schema ?? Map())
        })
      )
    }

    if (Date.now() - lastUpdate.current > 5000) {
      update()
      lastUpdate.current = Date.now()
      return
    }
    const timeToWait = Math.max(5000, 5000 - (Date.now() - lastUpdate.current))
    const timeout = setTimeout(() => {
      update()
      lastUpdate.current = Date.now()
    }, timeToWait)

    return () => {
      clearTimeout(timeout)
    }
  }, [datasources, schemas])

  return (
    <Context.Provider value={getExtension}>{props.children}</Context.Provider>
  )
}
