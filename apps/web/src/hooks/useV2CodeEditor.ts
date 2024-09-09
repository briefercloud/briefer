import * as Y from 'yjs'
import { DiffOnMount, OnMount } from '@monaco-editor/react'
import { useCallback, useEffect, useState } from 'react'
import { editor, KeyMod, KeyCode } from 'monaco-editor'
import { MonacoBinding } from 'y-monaco'
import useSideBar from './useSideBar'
import { updateYText } from '@briefer/editor'
import { useHotkeysContext } from 'react-hotkeys-hook'
import useEditorAwareness from './useEditorAwareness'

const MAX_EDITOR_CHARACTERS = 15000

const noOpDiffAlgorithm = {
  onDidChange: () => {},
  async computeDiff() {
    return {
      diffs: null,
      changes: [],
      moves: [],
      identical: true,
      quitEarly: false,
    }
  },
}

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  theme: 'light-custom',
  minimap: { enabled: false },
  wordWrap: 'on',
  renderLineHighlight: 'none',
  scrollBeyondLastLine: false,
  overviewRulerLanes: 0,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
  },
  maxTokenizationLineLength: 1000,
}

export const diffEditorOptions: editor.IStandaloneDiffEditorConstructionOptions =
  {
    ...editorOptions,
    renderOverviewRuler: false,

    // @ts-ignore
    diffAlgorithm: noOpDiffAlgorithm,
  }

function useCodeEditor(
  blockId: string,
  source: Y.Text,
  diffSource: Y.Text | null,
  onRun: () => void,
  isLoading: boolean,
  readOnly: boolean,
  onOpenAIForm?: () => void,
  selectBelow?: () => void,
  insertBelow?: () => void
) {
  const [isSideBarOpen] = useSideBar()
  const [editor, setEditor] = useState<editor.IStandaloneCodeEditor>()
  const [diffEditor, setDiffEditor] =
    useState<null | editor.IStandaloneDiffEditor>(null)

  const onMount: OnMount = useCallback(
    (editor) => {
      setEditor(editor)
    },
    [setEditor]
  )

  const onMountDiffEditor: DiffOnMount = useCallback(
    (editor) => {
      setDiffEditor(editor)
    },
    [setDiffEditor]
  )

  const { interactionState, setInteractionState } = useEditorAwareness()
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  useEffect(() => {
    const disposeFocus = editor?.onDidFocusEditorText(() => {
      setIsEditorFocused(true)
      setInteractionState({
        cursorBlockId: null,
        mode: 'normal',
        scrollIntoView: false,
      })
    })

    const disposeBlur = editor?.onDidBlurEditorText(() => {
      setIsEditorFocused(false)
      setInteractionState({
        cursorBlockId: blockId,
        mode: 'normal',
        scrollIntoView: false,
      })
    })

    return () => {
      disposeFocus?.dispose()
      disposeBlur?.dispose()
    }
  }, [editor, blockId, setInteractionState])

  useEffect(() => {
    if (!editor) {
      return
    }

    if (
      interactionState.cursorBlockId === blockId &&
      interactionState.mode === 'insert' &&
      !interactionState.scrollIntoView
    ) {
      const scrollView = document.getElementById('editor-scrollview')
      editor.focus()
      setIsEditorFocused(true)

      if (!scrollView) {
        return
      }

      const currentLine = editor.getPosition()?.lineNumber ?? 0
      const top = editor.getTopForLineNumber(currentLine)
      scrollView.scrollBy({
        top: top - scrollView.getBoundingClientRect().top - 80,
        behavior: 'smooth',
      })
    }
  }, [interactionState, blockId, editor])

  useEffect(() => {
    const color = isLoading ? '#f3f4f6' : '#ffffff'

    const style = editor?.getDomNode()?.style
    style?.setProperty('--vscode-editor-background', color)
    style?.setProperty('--vscode-editorGutter-background', color)

    const originalDiffStyle = diffEditor
      ?.getOriginalEditor()
      .getDomNode()?.style
    originalDiffStyle?.setProperty('--vscode-editor-background', color)
    originalDiffStyle?.setProperty('--vscode-editorGutter-background', color)

    const modifiedDiffStyle = diffEditor
      ?.getModifiedEditor()
      .getDomNode()?.style
    modifiedDiffStyle?.setProperty('--vscode-editor-background', color)
    modifiedDiffStyle?.setProperty('--vscode-editorGutter-background', color)

    editor?.updateOptions({ readOnly: isLoading || readOnly })
  }, [isLoading, editor, diffEditor, readOnly])

  // keybindings
  useEffect(() => {
    if (!editor) {
      return
    }

    editor.addAction({
      id: 'run-select-below',
      label: 'Blur Editor',
      keybindings: [KeyCode.Escape],
      run: () => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      },
    })

    if (!readOnly) {
      editor.addAction({
        id: 'run-block',
        label: 'Run block',
        keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
        run: onRun,
      })

      editor.addAction({
        id: 'run-and-select-below',
        label: 'Run block and select below',
        keybindings: [KeyMod.Shift | KeyCode.Enter],
        run: () => {
          onRun()
          selectBelow?.()
        },
      })

      editor.addAction({
        id: 'run-and-insert-below',
        label: 'Run block and insert below',

        keybindings: [KeyMod.Alt | KeyCode.Enter],
        run: () => {
          console.log('run-and-insert-below')
          onRun()
          insertBelow?.()
        },
      })

      if (onOpenAIForm) {
        editor.addAction({
          id: 'open-ai-edit-form',
          label: 'Open AI edit form',
          keybindings: [KeyMod.CtrlCmd | KeyCode.KeyE],
          run: onOpenAIForm,
        })
      }
    } else {
      editor.addAction({
        id: 'run-block',
        label: 'Run block',
        keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
        run: () => {},
      })

      editor.addAction({
        id: 'run-and-select-below',
        label: 'Run block and select below',
        keybindings: [KeyMod.Shift | KeyCode.Enter],
        run: () => {},
      })

      editor.addAction({
        id: 'run-and-insert-below',
        label: 'Run block and insert below',
        keybindings: [KeyMod.Alt | KeyCode.Enter],
        run: () => {},
      })

      if (onOpenAIForm) {
        editor.addAction({
          id: 'open-ai-edit-form',
          label: 'Open AI edit form',
          keybindings: [KeyMod.CtrlCmd | KeyCode.KeyE],
          run: () => {},
        })
      }
    }
  }, [editor, onRun, onOpenAIForm, readOnly])

  // monaco binding
  useEffect(() => {
    if (!editor) {
      return
    }

    const model = editor.getModel()
    if (!model) {
      return
    }

    if (source.length > MAX_EDITOR_CHARACTERS) {
      source.delete(MAX_EDITOR_CHARACTERS, source.length)
    }

    const onDidChangeSource = () => {
      if (source.length > MAX_EDITOR_CHARACTERS) {
        const newSource = source.toString().slice(0, MAX_EDITOR_CHARACTERS)
        updateYText(source, newSource)
        model.setValue(newSource)
      }
    }
    source.observe(onDidChangeSource)

    const monacoBinding = new MonacoBinding(source, model, new Set([editor]))
    return () => {
      monacoBinding.destroy()
      source.unobserve(onDidChangeSource)
    }
  }, [editor, source, editor?.getModel()])

  // layout
  useEffect(() => {
    if (!editor) {
      return
    }

    function onDidContentSizeChange() {
      if (!editor) {
        return
      }

      editor.layout({
        width: editor.getLayoutInfo().width,
        height: editor.getContentHeight(),
      })
    }

    const disposeDidContentSizeChange = editor.onDidContentSizeChange(
      onDidContentSizeChange
    )
    onDidContentSizeChange()

    return () => {
      disposeDidContentSizeChange.dispose()
    }
  }, [editor])

  useEffect(() => {
    if (!diffEditor || !diffSource) {
      return
    }

    const diff = diffEditor

    function onDidContentSizeChange() {
      const originalEditor = diff.getOriginalEditor()
      const modifiedEditor = diff.getModifiedEditor()

      const height = Math.max(
        originalEditor.getContentHeight(),
        modifiedEditor.getContentHeight()
      )
      const editorContainer = diff.getContainerDomNode()
      editorContainer.style.height = `${height}px`
    }

    const originalEditor = diff.getOriginalEditor()
    const originalDispose = originalEditor.onDidContentSizeChange(
      onDidContentSizeChange
    )

    const modifiedEditor = diff.getModifiedEditor()
    const modifiedDispose = modifiedEditor.onDidContentSizeChange(
      onDidContentSizeChange
    )

    onDidContentSizeChange()

    const originalMonacoBinding = new MonacoBinding(
      source,
      originalEditor.getModel()!,
      new Set([originalEditor])
    )

    const modifiedMonacoBinding = new MonacoBinding(
      diffSource,
      modifiedEditor.getModel()!,
      new Set([modifiedEditor])
    )

    return () => {
      originalDispose.dispose()
      modifiedDispose.dispose()

      originalMonacoBinding.destroy()
      modifiedMonacoBinding.destroy()
    }
  }, [diffEditor, source, diffSource])

  const [key, setKey] = useState(
    `${isSideBarOpen ? 'sidebar' : ''}-${window.innerWidth}`
  )
  useEffect(() => {
    if (!editor) {
      return
    }

    const onResize = () => {
      setKey(`${isSideBarOpen ? 'sidebar' : ''}-${window.innerWidth}`)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [isSideBarOpen, editor])

  useEffect(() => {
    setKey(`${isSideBarOpen ? 'sidebar' : ''}-${window.innerWidth}`)
  }, [isSideBarOpen])

  useEffect(() => {
    editor?.updateOptions({ readOnly })
    diffEditor?.updateOptions({ readOnly })
  }, [editor, diffEditor, readOnly])

  const focusEditor = useCallback(() => {
    editor?.focus()
  }, [editor])

  const reLayout = useCallback(() => {
    editor?.layout({
      width: editor.getLayoutInfo().width,
      height: editor.getContentHeight(),
    })
  }, [editor])

  const acceptDiffEditor = useCallback(() => {
    const model = editor?.getModel()
    const modifiedModel = diffEditor?.getModifiedEditor()?.getModel()
    if (!model || !modifiedModel) {
      return
    }

    const fullRange = model.getFullModelRange()
    model.pushEditOperations(
      null,
      [
        {
          range: fullRange,
          text: modifiedModel.getValue(),
        },
      ],
      () => null
    )
  }, [diffEditor, editor])

  return {
    key,
    editor,
    isEditorFocused,
    focusEditor,
    onMount,
    onMountDiffEditor,
    editorOptions,
    diffEditorOptions,
    reLayout,
    acceptDiffEditor,
  }
}

export default useCodeEditor
