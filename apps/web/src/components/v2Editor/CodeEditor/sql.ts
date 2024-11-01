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
import { useMemo } from 'react'
import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { DataSourceSchema } from '@briefer/types'
import { APIDataSource } from '@briefer/database'
import useDebouncedMemo from '@/hooks/useDebouncedMemo'

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
  const [{ datasources, schemas }] = useDataSources(workspaceId)
  const { datasource, schema } = useMemo(
    () => ({
      datasource:
        datasources?.find((ds) => ds.config.data.id === dataSourceId) ?? null,
      schema: dataSourceId
        ? schemas.get(dataSourceId)
        : Map<string, DataSourceSchema>(),
    }),
    [datasources, schemas, dataSourceId]
  )

  return useDebouncedMemo(
    () => language(datasource, schema ?? Map()),
    [datasource, schema],
    5000
  )
}
