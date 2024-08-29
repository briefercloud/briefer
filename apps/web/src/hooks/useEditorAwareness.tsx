import {
  useState,
  createContext,
  useContext,
  useEffect,
  Dispatch,
  SetStateAction,
} from 'react'
import { useHotkeysContext } from 'react-hotkeys-hook'
import { Awareness } from 'y-protocols/awareness.js'

export type InteractionState = {
  mode: 'normal' | 'insert'
  cursorBlockId: string | null
  scrollIntoView: boolean
}

export type InteractionStateDispatcher = Dispatch<
  SetStateAction<{
    mode: 'normal' | 'insert'
    cursorBlockId: string | null
    scrollIntoView: boolean
  }>
>

const Context = createContext<{
  interactionState: {
    mode: 'normal' | 'insert'
    cursorBlockId: string | null
    scrollIntoView: boolean
  }
  setInteractionState: InteractionStateDispatcher
}>({
  interactionState: {
    mode: 'normal',
    cursorBlockId: null,
    scrollIntoView: false,
  },
  setInteractionState: () => {},
})

interface Props {
  awareness: Awareness
  children: React.ReactNode
}

export const EditorAwarenessProvider = (props: Props) => {
  const { disableScope, enableScope } = useHotkeysContext()

  const [interactionState, setInteractionState] = useState<InteractionState>({
    mode: 'normal',
    cursorBlockId: null,
    scrollIntoView: false,
  })

  useEffect(() => {
    if (interactionState.mode === 'normal') {
      enableScope('editor')
    } else {
      disableScope('editor')
    }
  }, [interactionState.mode, enableScope, disableScope])

  return (
    <Context.Provider
      value={{
        interactionState,
        setInteractionState,
      }}
    >
      {props.children}
    </Context.Provider>
  )
}

export default function useEditorAwareness() {
  return useContext(Context)
}
