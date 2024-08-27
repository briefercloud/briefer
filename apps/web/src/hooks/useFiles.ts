import { uniqBy } from 'ramda'
import fetcher from '@/utils/fetcher'
import { BrieferFile } from '@briefer/types'
import axios from 'axios'
import qs from 'qs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'

export type UploadFile = {
  status: 'enqueued' | 'uploading' | 'asking-replace'
  replace: boolean
  file: File
  abortController: AbortController
  uploaded: number
  total: number
}

export type UploadResult = {
  outcome: 'unexpected' | 'file-exists' | 'aborted' | 'success'
  file: File
}

export type UploadingFileUploadState = {
  _tag: 'uploading'
  results: UploadResult[]
  current: UploadFile
  rest: File[]
  replaceAll: boolean
}

export type FileUploadState =
  | UploadingFileUploadState
  | {
      _tag: 'idle'
      results: UploadResult[]
    }

type State = {
  files: BrieferFile[]
  deleting: Record<string, boolean>
  upload: FileUploadState
}
type API = {
  del: (path: string) => Promise<void>
  onDrop: (files: File[]) => void
  onReplaceYes: () => void
  onReplaceAll: () => void
  onReplaceNo: () => void
  onAbort: (file: File) => void
  onRemoveResult: (file: File) => void
}

type UseFiles = [State, API]

export const useFiles = (
  workspaceId: string,
  refreshInterval?: number
): UseFiles => {
  const { data, mutate } = useSWR<BrieferFile[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/files`,
    fetcher,
    { refreshInterval: refreshInterval ?? 0, refreshWhenHidden: false }
  )

  useEffect(() => {
    if (refreshInterval ?? 0 > 0) {
      mutate()
    }
  }, [refreshInterval])

  const files = useMemo(() => data ?? [], [data])
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  const del = useCallback(
    async (path: string) => {
      setDeleting((prev) => ({ ...prev, [path]: true }))
      const params = qs.stringify({ path })
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/files/?${params}`,
          {
            credentials: 'include',
            method: 'DELETE',
          }
        )
        mutate(files.filter((f) => f.path !== path))
      } finally {
        setDeleting((prev) => ({ ...prev, [path]: false }))
      }
    },
    [workspaceId, mutate, files]
  )

  const [uploadState, setUploadState] = useState<FileUploadState>({
    _tag: 'idle',
    results: [],
  })

  const onReplaceYes = useCallback(() => {
    setUploadState((s) => {
      if (s._tag !== 'uploading') {
        return s
      }

      if (s.current.status !== 'asking-replace') {
        return s
      }

      return {
        ...s,
        current: {
          ...s.current,
          replace: true,
          status: 'enqueued',
        },
      }
    })
  }, [])

  const onReplaceAll = useCallback(() => {
    setUploadState((s) => {
      if (s._tag !== 'uploading') {
        return s
      }

      if (s.current.status !== 'asking-replace') {
        return {
          ...s,
          replaceAll: true,
        }
      }

      return {
        ...s,
        current: {
          ...s.current,
          replace: true,
          status: 'enqueued',
        },
        replaceAll: true,
      }
    })
  }, [])

  const onReplaceNo = useCallback(() => {
    setUploadState((s) => {
      if (s._tag !== 'uploading') {
        return s
      }

      if (s.current.status !== 'asking-replace') {
        return s
      }

      const [next, ...rest] = s.rest
      if (!next) {
        return {
          _tag: 'idle',
          results: [
            ...s.results,
            {
              outcome: 'file-exists',
              file: s.current.file,
            },
          ],
        }
      }

      return {
        ...s,
        results: [
          ...s.results,
          {
            outcome: 'file-exists',
            file: s.current.file,
          },
        ],
        current: {
          status: 'enqueued',
          replace: false,
          file: next,
          abortController: new AbortController(),
          uploaded: 0,
          total: next.size,
        },
        rest,
      }
    })
  }, [])

  useEffect(() => {
    if (uploadState._tag !== 'uploading') {
      return
    }

    if (uploadState.current.status === 'asking-replace') {
      return
    }

    if (uploadState.current.status === 'uploading') {
      return
    }

    setUploadState({
      ...uploadState,
      current: {
        ...uploadState.current,
        status: 'uploading',
      },
    })

    const fileExists = files.some(
      (f) => f.name === uploadState.current.file.name
    )

    if (!uploadState.current.replace && !uploadState.replaceAll && fileExists) {
      // set to asking-replace
      setUploadState({
        ...uploadState,
        current: { ...uploadState.current, status: 'asking-replace' },
      })
      return
    }

    const replace = uploadState.current.replace || uploadState.replaceAll
    const url = `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/files?replace=${replace}`
    axios({
      signal: uploadState.current.abortController.signal,
      url,
      method: 'POST',
      withCredentials: true,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': uploadState.current.file.name,
        'X-File-Size': uploadState.current.file.size.toString(),
      },
      data: uploadState.current.file,
      onUploadProgress: (e) => {
        setUploadState((s) => {
          if (s._tag !== 'uploading') {
            return s
          }

          if (s.current.status !== 'uploading') {
            return s
          }

          return {
            ...s,
            current: { ...s.current, uploaded: e.loaded },
          }
        })
      },
    })
      .then(async (res) => {
        if (res.status === 204) {
          setUploadState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            if (s.current.status !== 'uploading') {
              return s
            }

            const [next, ...rest] = s.rest
            if (!next) {
              return {
                _tag: 'idle',
                results: [
                  ...s.results,
                  { outcome: 'success', file: s.current.file },
                ],
              }
            }

            return {
              ...s,
              current: {
                file: next,
                abortController: new AbortController(),
                uploaded: 0,
                total: next.size,
                status: 'enqueued',
                replace: false,
              },
              rest,
              results: [
                ...s.results,
                { outcome: 'success', file: s.current.file },
              ],
            }
          })
        } else {
          setUploadState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            if (s.current.status !== 'uploading') {
              return s
            }

            const [next, ...rest] = s.rest

            return {
              ...s,
              current: {
                file: next,
                abortController: new AbortController(),
                uploaded: 0,
                total: next.size,
                status: 'enqueued',
                replace: false,
              },
              rest,
              results: [
                ...s.results,
                { outcome: 'unexpected', file: s.current.file },
              ],
            }
          })
        }
      })
      .catch((err) => {
        const errorStatus = err.response?.status ?? 500
        if (errorStatus === 409) {
          setUploadState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            if (s.current.status !== 'uploading') {
              return s
            }

            return {
              ...s,
              current: { ...s.current, status: 'asking-replace' },
            }
          })
        } else if (err.name === 'CanceledError') {
          setUploadState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            const [next, ...rest] = s.rest
            if (!next) {
              return {
                _tag: 'idle',
                results: [
                  ...s.results,
                  { file: s.current.file, outcome: 'aborted' },
                ],
              }
            }

            return {
              ...s,
              current: {
                file: next,
                abortController: new AbortController(),
                uploaded: 0,
                total: next.size,
                status: 'enqueued',
                replace: false,
              },
              rest,
              results: [
                ...s.results,
                { outcome: 'aborted', file: s.current.file },
              ],
            }
          })
        } else {
          setUploadState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            if (s.current.status !== 'uploading') {
              return s
            }

            const [next, ...rest] = s.rest
            if (!next) {
              return {
                _tag: 'idle',
                results: [
                  ...s.results,
                  { outcome: 'unexpected', file: s.current.file },
                ],
              }
            }

            return {
              ...s,
              current: {
                file: next,
                abortController: new AbortController(),
                uploaded: 0,
                total: next.size,
                status: 'enqueued',
                replace: false,
              },
              rest,
              results: [
                ...s.results,
                { outcome: 'unexpected', file: s.current.file },
              ],
            }
          })
        }
      })
      .finally(() => {
        mutate()
      })
  }, [uploadState, mutate])

  const onDrop = useCallback((files: File[]) => {
    files = uniqBy((f) => f.name, files)
    const [first, ...rest] = files
    if (!first) {
      return
    }

    setUploadState((s) => {
      const results = s.results.filter((r) =>
        files.every((f) => f.name !== r.file.name)
      )
      switch (s._tag) {
        case 'idle':
          return {
            _tag: 'uploading',
            current: {
              status: 'enqueued',
              file: first,
              abortController: new AbortController(),
              uploaded: 0,
              total: first.size,
              replace: false,
            },
            rest,
            results,
            replaceAll: false,
          }
        case 'uploading':
          return {
            ...s,
            rest: [...s.rest, first, ...files],
            results,
          }
      }
    })
  }, [])

  const onAbort = useCallback(
    (file: File) => {
      if (uploadState._tag !== 'uploading') {
        return
      }

      if (uploadState.current.file === file) {
        uploadState.current.abortController.abort()
        return
      }

      // remove from rest
      setUploadState((s) => {
        if (s._tag !== 'uploading') {
          return s
        }

        return {
          ...s,
          rest: s.rest.filter((f) => f !== file),
        }
      })
    },
    [uploadState]
  )

  const onRemoveResult = useCallback(
    (file: File) => {
      setUploadState((s) => ({
        ...s,
        results: s.results.filter((r) => r.file !== file),
      }))
    },
    [setUploadState]
  )

  return useMemo(
    () => [
      { files, deleting, upload: uploadState },
      {
        del,
        onDrop,
        onReplaceYes,
        onReplaceAll,
        onReplaceNo,
        onAbort,
        onRemoveResult,
      },
    ],
    [
      files,
      deleting,
      uploadState,
      del,
      onDrop,
      onReplaceYes,
      onReplaceAll,
      onReplaceNo,
      onAbort,
      onRemoveResult,
    ]
  )
}
