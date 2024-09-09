import { DataSource } from '@briefer/database'
import { useCallback, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { editor } from 'monaco-editor'
import { NEXT_PUBLIC_API_WS_URL } from '@/utils/env'

export type AIResult = {
  data?: string
  loading: boolean
  error?: Error
}

export type AIAPI<I> = {
  run: (input: I) => Promise<string>
  consume: () => void
}

export type UseAI<I> = [AIResult, AIAPI<I>]

export type SQLAIInput = {
  dataSourceId: string
  dataSourceType: DataSource['type']
  query: string
  instructions: string
}

export type DefaultInitialInput = {
  workspaceId: string
  documentId: string
}

export const useAI = <OnRunInputT, Output, InitialInput = DefaultInitialInput>(
  initialInput: InitialInput,
  eventName: string,
  getOutput: (data: Output) => string
): UseAI<OnRunInputT> => {
  const [state, setState] = useState<AIResult>({
    data: undefined,
    loading: false,
    error: undefined,
  })

  const run = useCallback(
    async (input: OnRunInputT) => {
      setState({
        error: undefined,
        loading: true,
        data: undefined,
      })

      return new Promise<string>((resolve, reject) => {
        let finished = false
        let error: Error | undefined = undefined

        const socket = io(NEXT_PUBLIC_API_WS_URL!, {
          withCredentials: true,
        })

        let finalData = ''
        socket.on(`ai-edit-${eventName}-output`, (data) => {
          finalData = getOutput(data)
          setState((s) => ({ ...s, data: finalData }))
        })

        socket.on(`ai-edit-${eventName}-finish`, () => {
          finished = true
          setState((s) => ({ ...s, loading: false }))
        })

        socket.on('disconnect', () => {
          if (finished) {
            resolve(finalData)
          } else {
            const err = error ?? new Error('Disconnected from the server')
            console.error(err)
            setState((s) => ({
              ...s,
              loading: false,
              error: err,
            }))
            reject(err)
          }
        })

        socket.on('error', (error) => {
          setState((s) => ({
            ...s,
            loading: false,
            error: new Error(`Socket error: ${error.message}`),
          }))
        })

        socket.on(`ai-edit-${eventName}-error`, (data) => {
          error = new Error(data.error)
          setState((s) => ({
            ...s,
            loading: false,
            error,
          }))
        })

        socket.emit(`ai-edit-${eventName}`, { ...initialInput, ...input })
      })
    },
    [initialInput, setState]
  )

  const consume = useCallback(() => {
    setState({ data: undefined, error: undefined, loading: false })
  }, [setState])

  return useMemo(() => [state, { run, consume }], [state, run, consume])
}

export const useSQLAI = (
  workspaceId: string,
  documentId: string,
  codeEditor: editor.IStandaloneCodeEditor | undefined,
  selectedDataSource: { id: string; type: DataSource['type'] } | undefined
): [
  AIResult,
  AIAPI<SQLAIInput> & {
    isPromptingAI: boolean
    setIsPromptingAI: (isPromptingAI: boolean) => void
    aiPrompt: string
    onChangeAIPrompt: (e: React.ChangeEvent<HTMLInputElement>) => void
    onEditWithAI: React.FormEventHandler<HTMLFormElement>
  }
] => {
  const [state, { run, consume }] = useAI<SQLAIInput, { sql: string }>(
    useMemo(
      () => ({
        workspaceId: workspaceId,
        documentId: documentId,
      }),
      [workspaceId, documentId]
    ),
    'sql',
    useCallback((data) => data.sql, [])
  )

  const [aiPrompt, setAIPrompt] = useState('')
  const [isPromptingAI, setIsPromptingAI] = useState(false)

  const onChangeAIPrompt = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAIPrompt(e.target.value)
    },
    [setAIPrompt]
  )

  const onEditWithAI: React.FormEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault()
      if (aiPrompt === null || !selectedDataSource) {
        return
      }

      const source = codeEditor?.getModel()?.getValue() ?? ''
      run({
        dataSourceId: selectedDataSource.id,
        dataSourceType: selectedDataSource.type,
        query: source,
        instructions: aiPrompt,
      })
    },
    [aiPrompt, codeEditor, run, selectedDataSource]
  )

  return [
    state,
    {
      run,
      consume,
      isPromptingAI,
      setIsPromptingAI,
      aiPrompt,
      onChangeAIPrompt,
      onEditWithAI,
    },
  ]
}
