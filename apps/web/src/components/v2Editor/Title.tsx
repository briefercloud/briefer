import * as Y from 'yjs'
import { EditorContent, useEditor } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
import Document from '@tiptap/extension-document'
import Placeholder from '@tiptap/extension-placeholder'
import Text from '@tiptap/extension-text'
import { mergeAttributes, Node } from '@tiptap/core'
import clsx from 'clsx'
import { TitleSkeleton } from './ContentSkeleton'
import { useEffect } from 'react'

export type Level = 1 | 2 | 3 | 4 | 5 | 6

export interface ITitleOptions {
  level: Level
  HTMLAttributes: Record<string, any>
}

export const TitleExtension = Node.create<ITitleOptions>({
  name: 'title',
  addOptions() {
    return {
      level: 1,
      onUpdate: () => {},
      HTMLAttributes: {},
    }
  },
  content: 'text*',
  marks: '',
  group: 'block',
  defining: true,
  addKeyboardShortcuts(this) {
    return {
      Enter: () => true,
    }
  },
  renderHTML({ HTMLAttributes }) {
    const level = this.options.level

    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ]
  },
})

interface Props {
  content: Y.XmlFragment
  isEditable: boolean
  isLoading: boolean
  isPDF: boolean
  style?: string
}

function Title(props: Props) {
  const editor = useEditor(
    {
      autofocus: true,
      editable: props.isEditable,
      extensions: [
        Document,
        Text,
        TitleExtension.configure({
          level: 1,
          HTMLAttributes: {
            style: 'font-weight: bold; font-size: 4rem;' + (props.style ?? ''),
          },
        }),
        Placeholder.configure({
          placeholder: 'Untitled',
          showOnlyWhenEditable: false,
        }),
        Collaboration.configure({
          fragment: props.content,
        }),
      ],
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          class:
            'min-h-full prose sm:prose-base prose-sm max-w-full rounded-sm focus:outline-0',
        },
      },
    },
    [props.content, props.isEditable, props.style]
  )

  useEffect(
    () => () => {
      // cleanup after unmount
      editor?.destroy()
    },
    [editor]
  )

  return (
    <div className="font-sans">
      <TitleSkeleton visible={props.isLoading} />
      <div className={clsx(props.isLoading && 'hidden')}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export default Title
