import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { Extension } from '@codemirror/state'
import { LanguageSupport } from '@codemirror/language'
import {
  globalCompletion,
  localCompletionSource,
  pythonLanguage,
} from '@codemirror/lang-python'
import useWebsocket from '@/hooks/useWebsocket'
import { useCallback, useMemo } from 'react'
import { PythonSuggestion, PythonSuggestionsResult } from '@briefer/types'

function getType(s: PythonSuggestion): string {
  switch (s.type) {
    case 'function':
      return 'function'
    case 'keyword':
    case 'statement':
      return 'keyword'
    case 'magic':
      return 'keyword'
    case 'class':
      return 'class'
    case 'property':
      return 'property'
    case 'path':
      return 'text'
    case 'instance':
      return 'variable'
    case 'module':
      return 'namespace'
    case '<unknown>':
      return 'text'
    default:
      console.warn(`Unexpected Python suggestion type: ${s.type}`)
      return 'text'
  }
}

function getRightNotIntersection(str1: string, str2: string): string {
  let i = 0
  while (i < str1.length) {
    i++
    const slice = str1.slice(str1.length - i)
    if (str2.startsWith(slice)) {
      break
    }
  }

  return str2.slice(i)
}

export function usePythonExtension(
  documentId: string,
  blockId: string
): Extension {
  const socket = useWebsocket()

  const socketCompletion = useCallback(
    async (context: CompletionContext): Promise<CompletionResult | null> => {
      if (!socket) {
        return null
      }

      return new Promise((resolve) => {
        socket.emit(
          'complete-python',
          {
            documentId,
            blockId,
            position: context.pos,
          },
          (result: PythonSuggestionsResult) => {
            if (result.status !== 'success') {
              console.error(
                `Failed to get Python completions: ${result.status}`
              )
              resolve(null)
              return
            }

            const completionResult: CompletionResult = {
              from: context.pos,
              options: result.suggestions.map((s) => {
                const content = context.state.sliceDoc(
                  Math.max(context.pos - s.text.length, 0),
                  context.pos
                )

                return {
                  label: getRightNotIntersection(content, s.text),
                  displayLabel: s.text,
                  type: getType(s),
                }
              }),
            }
            resolve(completionResult)
          }
        )
      })
    },
    [socket, documentId, blockId]
  )

  return useMemo(
    () =>
      new LanguageSupport(pythonLanguage, [
        pythonLanguage.data.of({ autocomplete: localCompletionSource }),
        pythonLanguage.data.of({ autocomplete: globalCompletion }),
        pythonLanguage.data.of({ autocomplete: socketCompletion }),
      ]),
    [socketCompletion]
  )
}
