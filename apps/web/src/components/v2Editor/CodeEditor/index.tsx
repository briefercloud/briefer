import * as Y from 'yjs'
import { useCallback, useEffect, useRef } from 'react'
import {
  Annotation,
  ChangeSpec,
  EditorState,
  StateField,
} from '@codemirror/state'
import { MergeView } from '@codemirror/merge'
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { basicSetup } from 'codemirror'
import { EditorView, keymap, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { materialLight } from './theme'

import useEditorAwareness from '@/hooks/useEditorAwareness'

function createTextSync(source: Y.Text) {
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(private view: EditorView) {
        this.observe()
      }

      public update(update: ViewUpdate) {
        console.log('update!')
        if (!update.docChanged) {
          return
        }

        const operation = () => {
          update.transactions.forEach((tr) => {
            if (tr.annotation(IsLocalAnnotation)) {
              return
            }

            tr.changes.iterChanges((fromA, toA, fromB, _toB, inserted) => {
              if (toA - fromA > 0) {
                source.delete(fromA, toA - fromA)
              }
              if (inserted.length > 0) {
                source.insert(fromB, inserted.toString())
              }
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
        console.log(source.toString())
        source.observe(this.onEvent)
      }

      private onEvent = (e: Y.YTextEvent, tr: Y.Transaction) => {
        console.log('onEvent', e, tr)
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

export type CodeEditor = {
  focus: () => void
}

interface Props {
  blockId: string
  source: Y.Text
  language: 'python' | 'sql'
  readOnly: boolean
  onEditWithAI: () => void
  onRun: () => void
  onInsertBlock: () => void
  diff?: Y.Text
}
export function CodeEditor(props: Props) {
  const [editorState, editorAPI] = useEditorAwareness()

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
  const mergeViewRef = useRef<MergeView | null>(null)

  useEffect(() => {
    if (!editorRef.current) {
      return
    }

    function getExtensions(source: Y.Text, diff?: Y.Text) {
      return [
        ...brieferKeyMaps({
          onBlur: editorAPI.blur,
          onEditWithAI: props.onEditWithAI,
          onRun: props.onRun,
          onRunSelectNext,
          onRunInsertBlock,
        }),
        basicSetup,
        EditorView.lineWrapping,
        ...(props.language === 'python'
          ? [python()]
          : props.language === 'sql'
            ? [sql()]
            : []),
        keymap.of(vscodeKeymap),
        EditorState.readOnly.of(props.readOnly),
        createTextSync(diff ?? source),
        materialLight,
      ]
    }

    function getSelection() {
      const selection =
        viewRef.current?.state.selection ??
        mergeViewRef.current?.a.state.selection

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
      mergeViewRef.current?.destroy()
      mergeViewRef.current = null
    }

    function initializeEditorView(parent: Element) {
      const selection = getSelection()
      destroyCurrent()

      const state = EditorState.create({
        extensions: getExtensions(props.source, props.diff),
        doc: props.source.toString(),
        selection,
      })

      return new EditorView({
        state,
        parent,
      })
    }

    function initializeMergeView(diff: Y.Text, parent: Element) {
      const selection = getSelection()
      destroyCurrent()

      const a = EditorState.create({
        extensions: getExtensions(props.source),
        doc: props.source.toString(),
        selection,
      })
      const b = EditorState.create({
        extensions: getExtensions(diff),
        doc: diff.toString(),
      })

      return new MergeView({
        a,
        b,
        parent,
      })
    }

    if (props.diff) {
      mergeViewRef.current = initializeMergeView(props.diff, editorRef.current)
    } else {
      viewRef.current = initializeEditorView(editorRef.current)
    }
  }, [props.source, props.diff, props.language, props.readOnly, editorRef])

  useEffect(() => {
    if (
      editorState.cursorBlockId === props.blockId &&
      editorState.mode === 'insert'
    ) {
      if (viewRef.current && !viewRef.current.hasFocus) {
        viewRef.current.focus()
      } else if (
        mergeViewRef.current &&
        !mergeViewRef.current.a.hasFocus &&
        !mergeViewRef.current.b.hasFocus
      ) {
        mergeViewRef.current.a.focus()
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

  return <div onClick={onClick} ref={editorRef}></div>
}
