import React, {
  useEffect,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from 'react'
import { useMonaco } from '@monaco-editor/react'
import debounce from 'lodash.debounce'
import * as sql from '@codemirror/lang-sql'
import { EditorState } from '@codemirror/state'
import { CompletionContext, CompletionSource } from '@codemirror/autocomplete'
import { languages } from 'monaco-editor'
import {
  DataSourceStructure,
  PythonCompletionMessage,
  PythonSuggestion,
} from '@briefer/types'
import useWebsocket from '@/hooks/useWebsocket'

const keywordRanking = [
  'SELECT',
  'DISTINCT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
  'ASC',
  'DESC',
  'BETWEEN',
  'LIKE',
  'IN',
  'IS',
  'NULL',
  'AND',
  'OR',
  'NOT',
  'AS',
  'ON',
  'USING',
  'WITH',
  'DISTINCT',
  'JOIN',
  'INNER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'UNION',
  'UNION ALL',
  'INTERSECT',
  'EXCEPT',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'ANY',
  'DO',
]

function adjustCasing(currentWord: string, suggestion: string): string {
  console.log(currentWord, suggestion)

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

type KnownMonacoKind =
  | languages.CompletionItemKind.Keyword
  | languages.CompletionItemKind.Class
  | languages.CompletionItemKind.Constructor
  | languages.CompletionItemKind.Variable
  | languages.CompletionItemKind.Property
  | languages.CompletionItemKind.Text
function getMonacoSchemaKind(type: string): KnownMonacoKind {
  switch (type) {
    case 'type':
      return languages.CompletionItemKind.Constructor
    case 'variable':
      return languages.CompletionItemKind.Variable
    case 'property':
      return languages.CompletionItemKind.Property
    default:
      console.warn(`Unexpected schema type: ${type}`)
      return languages.CompletionItemKind.Text
  }
}

function getMonacoKeywordKind(type: string): KnownMonacoKind {
  switch (type) {
    case 'keyword':
      return languages.CompletionItemKind.Keyword
    case 'type':
      return languages.CompletionItemKind.Class
    default:
      console.warn(`Unexpected keyword type: ${type}`)
      return languages.CompletionItemKind.Text
  }
}

function getSortText(c: string, kind: KnownMonacoKind): string {
  switch (kind) {
    case languages.CompletionItemKind.Property:
      return '00000'
    case languages.CompletionItemKind.Constructor:
      return '10000'
    case languages.CompletionItemKind.Keyword: {
      const ranking = keywordRanking.indexOf(c.toUpperCase())
      // if the keyword is not in the ranking, put it at the end
      if (ranking === -1) {
        return '89999'
      }

      return (20000 + ranking).toString().padStart(5, '0')
    }
    case languages.CompletionItemKind.Class:
      return '30000'
    case languages.CompletionItemKind.Variable:
      return '40000'
    case languages.CompletionItemKind.Text:
      return '90000'
  }
}

function getPythonKind(s: PythonSuggestion): languages.CompletionItemKind {
  switch (s.type) {
    case 'function':
      return languages.CompletionItemKind.Function
    case 'keyword':
    case 'statement':
      return languages.CompletionItemKind.Keyword
    case 'magic':
      return languages.CompletionItemKind.Event
    case 'class':
      return languages.CompletionItemKind.Class
    case 'property':
      return languages.CompletionItemKind.Property
    case 'path':
      return languages.CompletionItemKind.File
    case 'instance':
      return languages.CompletionItemKind.Variable
    case 'module':
      return languages.CompletionItemKind.Module
    case '<unknown>':
      return languages.CompletionItemKind.Text
    default:
      console.warn(`Unexpected Python suggestion type: ${s.type}`)
      return languages.CompletionItemKind.Text
  }
}

function getSchemaFromStructure(
  structure: DataSourceStructure
): sql.SQLNamespace {
  const namespace: sql.SQLNamespace = {}
  for (const [schemaName, schema] of Object.entries(structure.schemas)) {
    for (const [tableName, table] of Object.entries(schema.tables)) {
      namespace[`${schemaName}.${tableName}`] = table.columns.map(
        (column) => column.name
      )
    }
  }

  return namespace
}

type MonacoContextState = {
  editorReadiness: Record<string, boolean>
  modelDataSourceStructures: Record<string, CompletionSource>
}

type MonacoContextAPI = {
  setEditorReadiness: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >
  setModelDataSourceStructure: (
    modelId: string,
    dataSourceStructure: DataSourceStructure
  ) => void
  removeModelDataSourceStructure: (modelId: string) => void
  setModelDocumentBlock: (
    modelId: string,
    documentId: string,
    blockId: string
  ) => void
  removeModelDocumentBlock: (modelId: string) => void
}

type UseMonacoContext = [MonacoContextState, MonacoContextAPI]

export const MonacoContext = React.createContext<UseMonacoContext>([
  {
    editorReadiness: {},
    modelDataSourceStructures: {},
  },
  {
    setEditorReadiness: () => {},
    setModelDataSourceStructure: () => {},
    removeModelDataSourceStructure: () => {},
    setModelDocumentBlock: () => {},
    removeModelDocumentBlock: () => {},
  },
])

export function useMonacoContext(): UseMonacoContext {
  return React.useContext(MonacoContext)
}

interface Props {
  children: ReactNode
}
function MonacoProvider({ children }: Props) {
  const socket = useWebsocket()
  const monaco = useMonaco()
  const [editorReadiness, setEditorReadiness] = useState<
    Record<string, boolean>
  >({})
  const [modelDataSourceStructures, setModelDataSourceStructures] = useState<
    Record<string, CompletionSource>
  >({})
  const [modelsDocumentBlock, setModelsDocumentBlock] = useState<
    Record<string, { documentId: string; blockId: string }>
  >({})

  useEffect(() => {
    if (!monaco) {
      return
    }

    monaco.editor.defineTheme('light-custom', {
      base: 'vs',
      rules: [],
      inherit: true,
      colors: {
        // set to gray-200 and gray-300, respectively
        'editorLineNumber.foreground': '#e5e7eb',
        'editorLineNumber.activeForeground': '#d1d5db',
      },
    })

    const disposables: (() => void)[] = []

    const didCreateEditorDisposable = monaco.editor.onDidCreateEditor(
      (editor) => {
        const id = editor.getId()
        setEditorReadiness((prev) => ({ ...prev, [id]: false }))

        const setEditorReadinessDebounced = debounce(() => {
          setEditorReadiness((prev) => ({ ...prev, [id]: true }))
        }, 100)

        const timeout = setTimeout(setEditorReadinessDebounced, 500)
        const changeModelDecorationsDisposable =
          editor.onDidChangeModelDecorations(setEditorReadinessDebounced)

        disposables.push(() => {
          clearTimeout(timeout)
          changeModelDecorationsDisposable.dispose()
          setEditorReadinessDebounced.cancel()
        })
      }
    )

    disposables.push(() => didCreateEditorDisposable.dispose())
  }, [monaco])

  // autocomplete
  useEffect(() => {
    if (!monaco) {
      return
    }

    const disposables: (() => void)[] = []

    const sqlCompletionItemProviderDisposable =
      monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', '', '"', "'", '`'],
        provideCompletionItems: async (model, position) => {
          const schemaCompletionSource =
            modelDataSourceStructures[model.id] ??
            sql.schemaCompletionSource({ dialect: sql.StandardSQL })

          const keywordCompletionSource = sql.keywordCompletionSource(
            sql.StandardSQL,
            true
          )

          const doc = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          })

          const anchor = model.getOffsetAt(position)

          const state = EditorState.create({
            doc,
            selection: { anchor },
            extensions: [
              sql.PostgreSQL,
              sql.PostgreSQL.language.data.of({
                schemaCompletion: schemaCompletionSource,
                keywordCompletion: keywordCompletionSource,
              }),
            ],
          })

          const schemaLangData = state.languageDataAt<CompletionSource>(
            'schemaCompletion',
            anchor
          )
          const keywordLangData = state.languageDataAt<CompletionSource>(
            'keywordCompletion',
            anchor
          )

          const currentWord = model.getWordAtPosition(position)?.word

          const suggestions = (
            await Promise.all(
              schemaLangData.concat(keywordLangData).map(async (data, i) => {
                const isKeyword = i >= schemaLangData.length
                const result = await data(
                  new CompletionContext(state, anchor, true)
                )

                if (!result) {
                  return null
                }

                const suggestion: languages.CompletionItem[] = result.options
                  .filter((o) => {
                    if (currentWord) {
                      return o.label
                        .toLowerCase()
                        .startsWith(currentWord.toLowerCase())
                    }

                    return true
                  })
                  .map((c) => {
                    const kind = c.type
                      ? isKeyword
                        ? getMonacoKeywordKind(c.type)
                        : getMonacoSchemaKind(c.type)
                      : languages.CompletionItemKind.Text

                    let insertText = currentWord
                      ? adjustCasing(currentWord, c.label)
                      : c.label
                    insertText = insertText.slice(currentWord?.length)
                    return {
                      label: c.displayLabel ?? c.label,
                      kind,
                      // remove the intersection of the current word
                      insertText,
                      range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column + c.label.length,
                      },
                      sortText: getSortText(c.label, kind),
                    }
                  })

                return suggestion
              })
            )
          )
            .filter((cs): cs is languages.CompletionItem[] => cs !== null)
            .flat()

          return {
            suggestions,
          }
        },
      })
    disposables.push(() => sqlCompletionItemProviderDisposable.dispose())

    const pythonCompletionItemProviderDisposable =
      monaco.languages.registerCompletionItemProvider('python', {
        triggerCharacters: ['.', ''],
        provideCompletionItems: async (model, position) => {
          const editor = monaco.editor
            .getEditors()
            .find((e) => e.getModel() === model)
          const docBlock = modelsDocumentBlock[model.id]
          if (!docBlock || !editor || !socket) {
            return { suggestions: [] }
          }

          return new Promise((resolve, reject) => {
            let timedOut = false
            const timeout = setTimeout(() => {
              timedOut = true
              socket.off('python-completion', onCompletion)
              reject(new Error('Timeout'))
            }, 1000 * 60) // 1 minute

            const currentWord = model.getWordAtPosition(position)?.word ?? null

            const onCompletion = (data: PythonCompletionMessage) => {
              if (timedOut) {
                return
              }

              if (data.status !== 'success') {
                return
              }

              if (
                data.modelId !== model.id ||
                data.position !== model.getOffsetAt(position) ||
                data.currentWord !== currentWord
              ) {
                return
              }

              clearTimeout(timeout)
              socket.off('python-completion', onCompletion)
              resolve({
                suggestions: data.suggestions.map(
                  (s): languages.CompletionItem => ({
                    label: s.text,
                    kind: getPythonKind(s),
                    documentation: s.signature,
                    insertText: s.text.slice(currentWord?.length),
                    range: {
                      startLineNumber: position.lineNumber,
                      startColumn: position.column,
                      endLineNumber: position.lineNumber,
                      endColumn: position.column + s.text.length,
                    },
                  })
                ),
              })
            }
            socket.on('python-completion', onCompletion)

            socket?.emit('complete-python', {
              documentId: docBlock.documentId,
              blockId: docBlock.blockId,
              modelId: model.id,
              position: model.getOffsetAt(position),
              currentWord,
            })
          })
        },
      })

    disposables.push(() => pythonCompletionItemProviderDisposable.dispose())

    return () => {
      disposables.forEach((dispose) => dispose())
    }
  }, [socket, monaco, modelDataSourceStructures, modelsDocumentBlock])

  const state = useMemo(
    () => ({
      editorReadiness,
      modelDataSourceStructures,
    }),
    [editorReadiness, modelDataSourceStructures]
  )

  const [completionSources, setCompletionSources] = useState<
    Record<string, CompletionSource>
  >({})

  const setModelDataSourceStructure = useCallback(
    async (modelId: string, dataSourceStructure: DataSourceStructure) => {
      let completionSource = completionSources[dataSourceStructure.dataSourceId]
      if (!completionSource) {
        const schema = getSchemaFromStructure(dataSourceStructure)
        completionSource = await sql.schemaCompletionSource({
          dialect: sql.StandardSQL,
          schema,
          defaultSchema: dataSourceStructure.defaultSchema,
        })

        setCompletionSources((prev) => ({
          ...prev,
          [dataSourceStructure.dataSourceId]: completionSource,
        }))
      }
      setModelDataSourceStructures((prev) => ({
        ...prev,
        [modelId]: completionSource,
      }))
    },
    [completionSources]
  )

  const removeModelDataSourceStructure = useCallback((modelId: string) => {
    setModelDataSourceStructures((prev) => {
      const { [modelId]: _, ...rest } = prev
      return rest
    })
  }, [])

  const setModelDocumentBlock = useCallback(
    (modelId: string, documentId: string, blockId: string) => {
      setModelsDocumentBlock((prev) => ({
        ...prev,
        [modelId]: { documentId, blockId },
      }))
    },
    []
  )

  const removeModelDocumentBlock = useCallback((modelId: string) => {
    setModelsDocumentBlock((prev) => {
      const { [modelId]: _, ...rest } = prev
      return rest
    })
  }, [])

  const api = useMemo(
    () => ({
      setEditorReadiness,
      setModelDataSourceStructure,
      removeModelDataSourceStructure,
      setModelDocumentBlock,
      removeModelDocumentBlock,
    }),
    [
      setEditorReadiness,
      setModelDataSourceStructure,
      removeModelDataSourceStructure,
      setModelDocumentBlock,
      removeModelDocumentBlock,
    ]
  )

  const monacoContext: UseMonacoContext = useMemo(
    () => [state, api],
    [state, api]
  )

  return (
    <MonacoContext.Provider value={monacoContext}>
      {children}
    </MonacoContext.Provider>
  )
}

export default MonacoProvider
