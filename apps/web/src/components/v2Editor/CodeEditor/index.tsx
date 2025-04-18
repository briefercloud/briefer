import * as Y from 'yjs'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import {
  Annotation,
  ChangeSpec,
  Compartment,
  EditorState,
} from '@codemirror/state'
import { MergeView } from '@codemirror/merge'
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap'
import { basicSetup } from 'codemirror'
import { indentUnit } from '@codemirror/language'
import { EditorView, keymap, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { historyField } from '@codemirror/commands'
import { materialLight } from './theme'

import useEditorAwareness from '@/hooks/useEditorAwareness'
import { useSQLExtension } from './sql'
import { usePythonExtension } from './python'

function getSelectedCodeFromState(e: EditorState): string | null {
  const { from, to } = e.selection.main
  const selection = e.sliceDoc(from, to)
  if (selection === '') {
    return null
  }

  return selection
}

function createTextSync(source: Y.Text) {
  const plugin = ViewPlugin.fromClass(
    class YTextSync {
      constructor(private view: EditorView) {
        this.observe()
      }

      public update(update: ViewUpdate) {
        if (!update.docChanged) {
          return
        }

        const operation = () => {
          update.transactions.forEach((tr) => {
            if (tr.annotation(IsLocalAnnotation)) {
              return
            }

            let adj = 0
            tr.changes.iterChanges((fromA, toA, _fromB, _toB, insert) => {
              const insertText = insert.sliceString(0, insert.length, '\n')
              if (fromA !== toA) {
                source.delete(fromA + adj, toA - fromA)
              }

              if (insertText.length > 0) {
                source.insert(fromA + adj, insertText)
              }

              adj += insertText.length - (toA - fromA)
            })
          })
        }

        if (source.doc) {
          source.doc.transact(operation)
        } else {
          operation()
        }
      }

      public destroy() {
        source.unobserve(this.onEvent)
      }

      private observe() {
        source.observe(this.onEvent)
      }

      private onEvent = (e: Y.YTextEvent, tr: Y.Transaction) => {
        if (tr.local) {
          return
        }

        const changeSpecs: ChangeSpec[] = []
        let pos = 0
        for (const change of e.delta) {
          if (change.insert) {
            const text =
              typeof change.insert === 'string'
                ? change.insert
                : Array.isArray(change.insert)
                ? change.insert.join('')
                : ''
            changeSpecs.push({
              from: pos,
              to: pos,
              insert: text,
            })
            pos += text.length
          } else if (change.delete) {
            changeSpecs.push({
              from: pos,
              to: pos + change.delete,
              insert: '',
            })
            pos += change.delete
          } else if (change.retain) {
            pos += change.retain
          }
        }

        const transaction = this.view.state.update({
          changes: changeSpecs,
          annotations: [IsLocalAnnotation.of(true)],
        })

        this.view.dispatch(transaction)
      }
    }
  )

  return plugin
}

const IsLocalAnnotation = Annotation.define<boolean>()

function brieferKeyMaps(cbs: {
  onBlur: () => void
  onEditWithAI: () => void
  onRun: () => void
  onRunSelectNext: () => void
  onRunInsertBlock: () => void
}) {
  return [
    keymap.of([
      {
        key: 'Escape',
        run: (view) => {
          view.contentDOM.blur()
          cbs.onBlur()
          return true
        },
      },
      {
        // command|ctrl + e
        key: 'Mod-e',
        run: () => {
          cbs.onEditWithAI()
          return true
        },
      },
      {
        // command|ctrl + enter
        key: 'Mod-Enter',
        run: () => {
          cbs.onRun()
          return true
        },
      },
      {
        // shift + enter
        key: 'Shift-Enter',
        run: () => {
          cbs.onRunSelectNext()
          return true
        },
      },
      {
        // alt enter
        key: 'Alt-Enter',
        run: () => {
          cbs.onRunInsertBlock()
          return true
        },
      },
    ]),
  ]
}

const sqlCompartment = new Compartment()
const pythonCompartment = new Compartment()
const readonlyCompartment = new Compartment()
const themeCompartment = new Compartment()
const keymapsCompartment = new Compartment()
const watchSelectionCompartment = new Compartment()

const createWatchSelectionPlugin = (
  callback: (selectedCode: string | null) => void
) =>
  ViewPlugin.fromClass(
    class WatchSelection {
      private selectedCode: string | null = null
      constructor(view: EditorView) {
        this.selectedCode = getSelectedCodeFromState(view.state)
      }

      public update(update: ViewUpdate) {
        if (!update.selectionSet) {
          return
        }

        const selectedCode = getSelectedCodeFromState(update.state)
        if (selectedCode === this.selectedCode) {
          return
        }
        this.selectedCode = selectedCode
        callback(selectedCode)
      }
    }
  )

export interface CodeEditorRef {
  insert: (
    snippet: string,
    selection: { from: number; to: number } | 'all',
    pos:
      | 'start'
      | 'end'
      | number
      | ((current: number) => 'start' | 'end' | number)
  ) => void
}

interface Props {
  workspaceId: string
  documentId: string
  blockId: string
  source: Y.Text
  language: 'python' | 'sql'
  readOnly: boolean
  onEditWithAI: () => void
  onRun: () => void
  onInsertBlock: () => void
  diff?: Y.Text
  dataSourceId?: string | null
  disabled: boolean
  onSelectionChanged?: (selectedCode: string | null) => void
}
const CodeEditor = forwardRef<CodeEditorRef, Props>(function CodeEditor(
  props,
  ref
) {
  const [editorState, editorAPI] = useEditorAwareness()
  const sql = useSQLExtension(props.workspaceId, props.dataSourceId ?? null)
  const python = usePythonExtension(props.documentId, props.blockId)

  const onRunInsertBlock = useCallback(() => {
    props.onRun()
    props.onInsertBlock()
  }, [props.onRun, props.onInsertBlock])

  const onRunSelectNext = useCallback(() => {
    props.onRun()
    editorAPI.move('below', 'insert')
  }, [props.onRun, editorAPI.move])

  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const mergeRef = useRef<{ view: MergeView; state: any } | null>(null)

  useEffect(() => {
    if (!editorRef.current) {
      return
    }

    function getExtensions(
      source: Y.Text,
      {
        disabled,
        watchSelection,
      }: { disabled: boolean; watchSelection: boolean }
    ) {
      return [
        keymapsCompartment.of(
          brieferKeyMaps({
            onBlur: editorAPI.blur,
            onEditWithAI: props.onEditWithAI,
            onRun: props.onRun,
            onRunSelectNext,
            onRunInsertBlock,
          })
        ),
        basicSetup,
        indentUnit.of(' '.repeat(4)),
        EditorView.lineWrapping,
        ...(props.language === 'python'
          ? [pythonCompartment.of(python)]
          : props.language === 'sql'
          ? [sqlCompartment.of(sql)]
          : []),
        keymap.of(vscodeKeymap),
        readonlyCompartment.of(
          EditorState.readOnly.of(props.disabled || props.readOnly)
        ),
        createTextSync(source),
        themeCompartment.of(materialLight(disabled)),
        ...(watchSelection
          ? [
              watchSelectionCompartment.of(
                createWatchSelectionPlugin(
                  props.onSelectionChanged ?? (() => {})
                )
              ),
            ]
          : []),
      ]
    }

    function getSelection() {
      const selection =
        viewRef.current?.state.selection ??
        mergeRef.current?.view.a.state.selection

      const isOutOfRange =
        selection &&
        selection.ranges.some(
          (range) =>
            range.from > props.source.length || range.to > props.source.length
        )

      if (isOutOfRange) {
        return undefined
      }

      return selection
    }

    function destroyCurrent() {
      viewRef.current?.destroy()
      viewRef.current = null
      mergeRef.current?.view.destroy()
      mergeRef.current = null
    }

    function initializeEditorView(parent: Element) {
      const selection = getSelection()
      const config = {
        extensions: getExtensions(props.source, {
          disabled: props.disabled,
          watchSelection: true,
        }),
        doc: props.source.toString(),
        selection,
      }

      const state =
        mergeRef.current && mergeRef.current.state
          ? EditorState.fromJSON(mergeRef.current.state, config, {
              // deserialize history
              history: historyField,
            })
          : EditorState.create(config)

      const comingFromMerge = mergeRef.current !== null
      destroyCurrent()

      const view = new EditorView({
        state,
        parent,
      })

      if (comingFromMerge) {
        // update doc
        view.dispatch(
          state.update({
            changes: [
              {
                from: 0,
                to: state.doc.length,
                insert: props.source.toString(),
              },
            ],
            annotations: [IsLocalAnnotation.of(true)],
          })
        )
      }

      return view
    }

    function initializeMergeView(diff: Y.Text, parent: Element) {
      const selection = getSelection()
      const state = viewRef.current?.state.toJSON({
        // serialize history
        history: historyField,
      })
      destroyCurrent()

      const a = {
        extensions: getExtensions(props.source, {
          disabled: props.disabled,
          watchSelection: false,
        }),
        doc: props.source.toString(),
        selection,
      }
      const b = {
        extensions: getExtensions(diff, {
          disabled: props.disabled,
          watchSelection: true,
        }),
        doc: diff.toString(),
      }

      return {
        view: new MergeView({
          a,
          b,
          parent,
        }),
        state,
      }
    }

    if (props.diff) {
      mergeRef.current = initializeMergeView(props.diff, editorRef.current)
    } else {
      viewRef.current = initializeEditorView(editorRef.current)
    }
  }, [viewRef, mergeRef, props.source, props.diff, props.language, editorRef])

  useEffect(() => {
    const effect = sqlCompartment.reconfigure(sql)
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: effect,
      })
      return
    }

    if (mergeRef.current) {
      mergeRef.current.view.a.dispatch({
        effects: effect,
      })
      mergeRef.current.view.b.dispatch({
        effects: effect,
      })
    }
  }, [sql])

  useEffect(() => {
    const effect = pythonCompartment.reconfigure(python)
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: effect,
      })
      return
    }

    if (mergeRef.current) {
      mergeRef.current.view.a.dispatch({
        effects: effect,
      })
      mergeRef.current.view.b.dispatch({
        effects: effect,
      })
    }
  }, [python])

  useEffect(() => {
    const effect = readonlyCompartment.reconfigure(
      EditorState.readOnly.of(props.disabled || props.readOnly)
    )
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: effect,
      })
      return
    }

    if (mergeRef.current) {
      mergeRef.current.view.a.dispatch({
        effects: effect,
      })
      mergeRef.current.view.b.dispatch({
        effects: effect,
      })
    }
  }, [props.disabled, props.readOnly])

  useEffect(() => {
    const effect = themeCompartment.reconfigure(materialLight(props.disabled))
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: effect,
      })
    }

    if (mergeRef.current) {
      mergeRef.current.view.a.dispatch({
        effects: effect,
      })
      mergeRef.current.view.b.dispatch({
        effects: effect,
      })
    }
  }, [props.disabled])

  useEffect(() => {
    const effect = keymapsCompartment.reconfigure(
      brieferKeyMaps({
        onBlur: editorAPI.blur,
        onEditWithAI: props.onEditWithAI,
        onRun: props.onRun,
        onRunSelectNext,
        onRunInsertBlock,
      })
    )

    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: effect,
      })
    }

    if (mergeRef.current) {
      mergeRef.current.view.a.dispatch({
        effects: effect,
      })
      mergeRef.current.view.b.dispatch({
        effects: effect,
      })
    }
  }, [
    editorAPI.blur,
    props.onEditWithAI,
    props.onRun,
    onRunSelectNext,
    onRunInsertBlock,
  ])

  useEffect(() => {
    const effect = watchSelectionCompartment.reconfigure(
      createWatchSelectionPlugin(props.onSelectionChanged ?? (() => {}))
    )

    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: effect,
      })
    }

    if (mergeRef.current) {
      mergeRef.current.view.a.dispatch({
        effects: effect,
      })
    }
  }, [viewRef, mergeRef, props.onSelectionChanged])

  useEffect(() => {
    if (
      editorState.cursorBlockId === props.blockId &&
      editorState.mode === 'insert'
    ) {
      if (viewRef.current && !viewRef.current.hasFocus) {
        viewRef.current.focus()
      } else if (
        mergeRef.current &&
        !mergeRef.current.view.a.hasFocus &&
        !mergeRef.current.view.b.hasFocus
      ) {
        mergeRef.current.view.a.focus()
      }
    }
  }, [editorState.cursorBlockId, editorState.mode, props.blockId])

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      editorAPI.insert(props.blockId, { scrollIntoView: false })
    },
    [editorAPI.insert, props.blockId]
  )

  useEffect(
    () => () => {
      // cleanup after unmount
      viewRef.current?.destroy()
      mergeRef.current?.view.destroy()
    },
    []
  )

  useImperativeHandle(
    ref,
    () => ({
      insert(snippet, selection, pos) {
        if (viewRef.current) {
          const currSelection = viewRef.current.state.selection.main

          let from = 0
          let to = currSelection.to
          if (pos === 'start') {
            from = 0
            to = from
          } else if (pos === 'end') {
            from = viewRef.current.state.doc.length
            to = from
          } else if (typeof pos === 'number') {
            from = Math.min(pos, Math.max(0, viewRef.current.state.doc.length))
          } else {
            const result = pos(currSelection.from)
            if (result === 'start') {
              from = 0
              to = from
            } else if (result === 'end') {
              from = viewRef.current.state.doc.length
              to = from
            } else {
              from = Math.min(
                result,
                Math.max(0, viewRef.current.state.doc.length)
              )
            }
          }

          viewRef.current.dispatch({
            changes: [
              {
                from,
                to,
                insert: snippet,
              },
            ],
            selection:
              selection === 'all'
                ? {
                    anchor: from,
                    head: from + snippet.length,
                  }
                : {
                    anchor: from + selection.from,
                    head: from + selection.to,
                  },
          })

          viewRef.current.focus()
        } else if (mergeRef.current) {
          const currSelection = mergeRef.current.view.b.state.selection.main

          let from = 0
          let to = 0
          if (pos === 'start') {
            from = 0
            to = from
          } else if (pos === 'end') {
            from = mergeRef.current.view.b.state.doc.length
            to = from
          } else if (typeof pos === 'number') {
            from = Math.min(
              pos,
              Math.max(0, mergeRef.current.view.b.state.doc.length)
            )
          } else {
            const result = pos(currSelection.from)
            if (result === 'start') {
              from = 0
              to = from
            } else if (result === 'end') {
              from = mergeRef.current.view.b.state.doc.length
              to = from
            } else {
              from = Math.min(
                result,
                Math.max(0, mergeRef.current.view.b.state.doc.length)
              )
            }
          }

          mergeRef.current.view.b.dispatch({
            changes: [
              {
                from,
                to,
                insert: snippet,
              },
            ],
            selection:
              selection === 'all'
                ? {
                    anchor: from,
                    head: from + snippet.length,
                  }
                : {
                    anchor: from + selection.from,
                    head: from + selection.to,
                  },
          })

          mergeRef.current.view.b.focus()
        }
      },
    }),
    [viewRef, mergeRef]
  )

  return <div onClick={onClick} ref={editorRef}></div>
})

export default CodeEditor
