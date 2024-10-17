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
import {
  DataSourceStructure,
  getDataSourceStructureFromState,
} from '@briefer/types'
import { APIDataSource } from '@briefer/database'

async function computeCompletion(dataSource: APIDataSource) {
  const structure = getDataSourceStructureFromState(dataSource.structure)
  const schema = getSchemaFromStructure(structure)
  return schemaCompletionSource({
    dialect: StandardSQL,
    schema,
    defaultSchema: structure?.defaultSchema ?? '',
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

function getSchemaFromStructure(
  structure: DataSourceStructure | null
): SQLNamespace {
  if (structure === null) {
    return {}
  }

  const namespace: SQLNamespace = {}
  for (const [schemaName, schema] of Object.entries(structure.schemas)) {
    for (const [tableName, table] of Object.entries(schema.tables)) {
      namespace[`${schemaName}.${tableName}`] = table.columns.map(
        (column) => column.name
      )
    }
  }

  return namespace
}

function language(dataSource: APIDataSource | null): Extension {
  const dialect: SQLDialect = (() => {
    if (!dataSource) {
      return StandardSQL
    }

    switch (dataSource.config.type) {
      case 'bigquery':
      case 'snowflake':
      case 'oracle':
      case 'trino':
      case 'athena':
        return StandardSQL
      case 'mysql':
        return MySQL
      case 'psql':
      case 'redshift':
        return PostgreSQL
      case 'sqlserver':
        return MSSQL
    }
  })()

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

  const completionSource = computeCompletion(dataSource)
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
  const [{ data: dataSources }] = useDataSources(workspaceId)
  const dataSource = useMemo(
    () => dataSources?.find((ds) => ds.config.data.id === dataSourceId) ?? null,
    [dataSources, dataSourceId]
  )

  return useMemo(() => language(dataSource), [dataSource])
}
