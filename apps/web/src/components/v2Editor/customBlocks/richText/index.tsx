import * as Y from 'yjs'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import FormattingToolbar from './FormattingToolbar'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import MathExtension from '@aarkue/tiptap-math-extension'
import type { RichTextBlock } from '@briefer/editor'
import clsx from 'clsx'
import { useCallback } from 'react'
import { ConnectDragPreview } from 'react-dnd'
import ImageExtension from './ImageExtension'

import 'katex/dist/katex.min.css'

const useBlockEditor = ({
  content,
  isEditable,
  setTitle,
}: {
  content: Y.XmlFragment
  isEditable: boolean
  setTitle: (title: string) => void
}) => {
  const editor = useEditor(
    {
      autofocus: false,
      editable: isEditable,
      extensions: [
        StarterKit.configure({
          history: false,
          dropcursor: false,
        }),
        Underline.configure({
          HTMLAttributes: {
            class: 'my-custom-class',
          },
        }),
        Collaboration.configure({
          fragment: content,
        }),
        Placeholder.configure({
          placeholder: 'Click here to start adding content.',
        }),
        Link.extend({ inclusive: false }).configure({
          HTMLAttributes: {
            class: 'cursor-pointer text-gray-500 hover:text-gray-700',
            target: '_blank',
          },
        }),
        TextStyle,
        Color.configure({
          types: ['textStyle'],
        }),
        Highlight.configure({
          multicolor: true,
        }),
        ImageExtension.configure({
          inline: true,
          allowBase64: true,
        }),
        MathExtension.configure({
          evaluation: false,
        }),
      ],
      onUpdate({ editor }) {
        const content = editor.getJSON()?.content
        const firstLineContent = content?.[0]?.content?.[0]?.text ?? ''
        setTitle(firstLineContent)
      },
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          class:
            'briefer-editor-body min-h-full prose sm:prose-base prose-sm max-w-full rounded-sm focus:outline-0 whitespace-pre-wrap ph-no-capture',
        },
      },
    },
    [content]
  )

  return { editor }
}

interface Props {
  block: Y.XmlElement<RichTextBlock>
  belongsToMultiTabGroup: boolean
  isEditable: boolean
  dragPreview: ConnectDragPreview | null
  isDashboard: boolean
}
const RichTextBlock = (props: Props) => {
  const id = props.block.getAttribute('id')!
  const content = props.block.getAttribute('content')!
  const setTitle = useCallback(
    (title: string) => {
      props.block.setAttribute('title', title)
    },
    [props.block]
  )

  const { editor } = useBlockEditor({
    content,
    setTitle,
    isEditable: props.isEditable,
  })

  return (
    <div
      data-testid={`RichTextBlock-${id}`}
      ref={(d) => {
        props.dragPreview?.(d)
      }}
      className={clsx(
        props.isDashboard ? 'px-4 py-3' : '',
        editor?.isFocused &&
          !props.belongsToMultiTabGroup &&
          props.isEditable &&
          'ring-1 ring-outline ring-offset-4 ring-gray-200',
        props.belongsToMultiTabGroup
          ? 'rounded-tl-none rounded-sm border border-gray-200 p-2'
          : 'rounded-sm'
      )}
    >
      <div className={editor?.isFocused ? 'block' : 'hidden'}>
        {editor && <FormattingToolbar editor={editor} />}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextBlock
