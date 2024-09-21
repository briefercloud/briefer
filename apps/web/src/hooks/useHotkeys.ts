import { BlockType } from '@briefer/editor'
import { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

type EditorActions = {
  moveCursor: (
    pos: 'above' | 'below' | 'left' | 'right',
    mode: 'normal' | 'insert'
  ) => void
  addBlock: (blockType: BlockType, pos: 'above' | 'below') => void
  deleteBlock: () => void
  focusCursorBlock: () => void
}

const useChords = (chords: string[]) => {
  const [chordState, setChordState] = useState<string | null>(null)

  useHotkeys(
    chords,
    (e, hotkey) => {
      const hotkeyStr = hotkey.keys?.join('+') ?? null
      if (!hotkeyStr) return

      if (chords.includes(hotkeyStr)) {
        setChordState(hotkeyStr)

        if (chordState !== hotkeyStr) {
          e.stopImmediatePropagation()
        }
      }
    },
    { scopes: ['editor'] }
  )

  // reset chords on any other key press
  useEffect(() => {
    const resetChords = (e: KeyboardEvent) => {
      if (chordState) {
        setChordState(null)
      }
    }

    window.addEventListener('keydown', resetChords)
    return () => {
      window.removeEventListener('keydown', resetChords)
    }
  }, [chords])

  return chordState
}

const useHotkeysHook = (actions: EditorActions) => {
  const chord = useChords(['a', 'b', 'd'])

  useHotkeys(
    ['h', 'left'],
    () => {
      actions.moveCursor('left', 'normal')
    },
    { scopes: ['editor'] }
  )

  useHotkeys(
    ['l', 'right'],
    () => {
      actions.moveCursor('right', 'normal')
    },
    { scopes: ['editor'] }
  )

  useHotkeys(
    ['j', 'down'],
    () => {
      actions.moveCursor('below', 'normal')
    },
    { scopes: ['editor'] }
  )

  useHotkeys(
    ['k', 'up'],
    () => {
      actions.moveCursor('above', 'normal')
    },
    { scopes: ['editor'] }
  )

  useHotkeys(
    'enter',
    () => {
      actions.focusCursorBlock()
    },
    { scopes: ['editor'], keydown: false, keyup: true }
  )

  useHotkeys(
    ['p', 'q', 'm'],
    (e, hotkeys) => {
      e.preventDefault()
      const hotkeyStr = hotkeys.keys?.join('+') ?? null
      const position = chord === 'a' ? 'above' : chord === 'b' ? 'below' : null

      if (!hotkeyStr || !position) {
        return
      }

      switch (hotkeyStr) {
        case 'p':
          actions.addBlock(BlockType.Python, position)
          break
        case 'q':
          actions.addBlock(BlockType.SQL, position)
          break
        case 'm':
          actions.addBlock(BlockType.RichText, position)
          break
      }
    },
    { scopes: ['editor'] }
  )

  useHotkeys(
    ['d', 'Backspace'],
    (_e, hotkeys) => {
      const hotkeyStr = hotkeys.keys?.join('+') ?? null
      if (hotkeyStr === 'Backspace' || (chord === 'd' && hotkeyStr === 'd')) {
        actions.deleteBlock()
      }
    },
    { scopes: ['editor'] }
  )
}

export default useHotkeysHook
