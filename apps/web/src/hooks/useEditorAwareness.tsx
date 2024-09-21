import * as Y from 'yjs'
import {
  getBlocks,
  getLayout,
  getRelativeBlockId,
  switchActiveTab,
} from '@briefer/editor'
import {
  useState,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
} from 'react'
import { useHotkeysContext } from 'react-hotkeys-hook'
import { Awareness } from 'y-protocols/awareness.js'

export type InteractionState = {
  mode: 'normal' | 'insert'
  cursorBlockId: string | null
  scrollIntoView: boolean
}
type Move = (
  dir: 'above' | 'below' | 'left' | 'right',
  mode: 'normal' | 'insert'
) => void

export type InteractionAPI = {
  insert: (blockId: string, opts: { scrollIntoView: boolean }) => void
  focus: (blockId: string, opts: { scrollIntoView: boolean }) => void
  blur: () => void
  move: Move
}

const Context = createContext<[InteractionState, InteractionAPI]>([
  {
    mode: 'normal',
    cursorBlockId: null,
    scrollIntoView: false,
  },
  {
    insert: () => {},
    focus: () => {},
    blur: () => {},
    move: () => {},
  },
])

type UseEditorAwareness = [InteractionState, InteractionAPI]

interface Props {
  awareness: Awareness
  scrollViewRef: React.RefObject<HTMLDivElement>
  children: React.ReactNode
  yDoc: Y.Doc
}
export function EditorAwarenessProvider(props: Props) {
  const { disableScope, enableScope } = useHotkeysContext()
  const [state, setState] = useState<InteractionState>({
    mode: 'normal',
    cursorBlockId: null,
    scrollIntoView: false,
  })

  useEffect(() => {
    if (state.mode === 'normal') {
      enableScope('editor')
    } else {
      disableScope('editor')
    }
  }, [state.mode, enableScope, disableScope])

  const insert = useCallback(
    (blockId: string, opts: { scrollIntoView: boolean }) => {
      setState({
        mode: 'insert',
        cursorBlockId: blockId,
        scrollIntoView: opts?.scrollIntoView,
      })
    },
    []
  )

  const focus = useCallback(
    (blockId: string, opts: { scrollIntoView: boolean }) => {
      setState({
        mode: 'normal',
        cursorBlockId: blockId,
        scrollIntoView: opts.scrollIntoView,
      })
    },
    []
  )

  const blur = useCallback(() => {
    setState((prev) => ({ ...prev, mode: 'normal' }))
  }, [])

  const move: Move = useCallback(
    (pos, mode) => {
      const result = getRelativeBlockId(
        getLayout(props.yDoc),
        getBlocks(props.yDoc),
        state.cursorBlockId,
        pos
      )
      if (!result) {
        return
      }

      const {
        blockGroupId: nextCursorBlockGroupId,
        blockId: nextCursorBlockId,
      } = result

      if (nextCursorBlockId === null) {
        return
      }

      if (pos === 'left' || pos === 'right') {
        switchActiveTab(
          getLayout(props.yDoc),
          nextCursorBlockGroupId,
          nextCursorBlockId
        )
      }

      switch (mode) {
        case 'normal':
          focus(nextCursorBlockId, { scrollIntoView: true })
          break
        case 'insert':
          insert(nextCursorBlockId, { scrollIntoView: true })
          break
      }
    },
    [props.yDoc, state.cursorBlockId, focus, insert]
  )

  const api: InteractionAPI = useMemo(
    () => ({
      insert,
      focus,
      blur,
      move,
    }),
    [insert, focus, blur, move]
  )

  // useImperativeHandle(ref, () => api, [api])

  const contextValue = useMemo(
    (): UseEditorAwareness => [state, api],
    [state, api]
  )

  useEffect(() => {
    if (state.cursorBlockId && state.scrollIntoView) {
      // find where data-block-id is equal to the cursorBlockId
      const el = document.querySelector(
        `[data-block-id="${state.cursorBlockId}"]`
      )
      if (!el || !props.scrollViewRef.current) {
        return
      }

      // const scrollViewTop = scrollViewRef.current.getBoundingClientRect().top
      const scrollRect = props.scrollViewRef.current.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()

      // if el height is larger than scroll view visible height, scroll to the top of the el
      if (elRect.height > scrollRect.height) {
        props.scrollViewRef.current.scrollBy({
          top: elRect.top - scrollRect.top - 48,
          behavior: 'smooth',
        })
      } else {
        // scroll el so that it's center is at the center of the scroll view
        const top =
          elRect.top -
          scrollRect.top -
          scrollRect.height / 2 +
          elRect.height / 2

        props.scrollViewRef.current.scrollBy({
          top,
          behavior: 'smooth',
        })
      }

      setState((prev) => ({ ...prev, scrollIntoView: false }))
    }
  }, [state.cursorBlockId, state.scrollIntoView, props.scrollViewRef])

  useEffect(() => {
    // if there is a click outside the scroll view, set mode to normal
    const handler = (e: MouseEvent) => {
      if (!props.scrollViewRef.current) {
        return
      }

      if (!props.scrollViewRef.current.contains(e.target as Node)) {
        blur()
      }
    }

    window.addEventListener('click', handler)

    return () => {
      window.removeEventListener('click', handler)
    }
  }, [props.scrollViewRef, blur])

  return (
    <Context.Provider value={contextValue}>{props.children}</Context.Provider>
  )
}

export default function useEditorAwareness(): UseEditorAwareness {
  return useContext(Context)
}
