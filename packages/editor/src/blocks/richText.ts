import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  YBlock,
  getAttributeOr,
  getBaseAttributes,
  duplicateBaseAttributes,
} from './index.js'
import { ExecutionStatus } from '../execution/item.js'
import { duplicateYXmlFragment } from '../index.js'

export type RichTextBlock = BaseBlock<BlockType.RichText> & {
  content: Y.XmlFragment
}
export const isRichTextBlock = (
  block: YBlock
): block is Y.XmlElement<RichTextBlock> => {
  return block.getAttribute('type') === BlockType.RichText
}

export const makeRichTextBlock = (id: string): Y.XmlElement<RichTextBlock> => {
  const yBlock = new Y.XmlElement<RichTextBlock>('block')

  const attrs: RichTextBlock = {
    id,
    index: null,
    title: '',
    type: BlockType.RichText,
    content: new Y.XmlFragment(),
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

export function getRichTextAttributes(
  block: Y.XmlElement<RichTextBlock>
): RichTextBlock {
  return {
    ...getBaseAttributes(block),
    content: getAttributeOr(block, 'content', new Y.XmlFragment()),
  }
}

export function duplicateRichTextBlock(
  newId: string,
  block: Y.XmlElement<RichTextBlock>
): Y.XmlElement<RichTextBlock> {
  const prevAttrs = getRichTextAttributes(block)

  const newAttrs: RichTextBlock = {
    ...duplicateBaseAttributes(newId, prevAttrs),
    content: duplicateYXmlFragment(prevAttrs.content),
  }

  const yBlock = new Y.XmlElement<RichTextBlock>('block')
  for (const [key, value] of Object.entries(newAttrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

export function getRichTextBlockExecStatus(
  _block: Y.XmlElement<RichTextBlock>
): ExecutionStatus {
  return 'completed'
}
