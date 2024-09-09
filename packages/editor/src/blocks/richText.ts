import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  YBlock,
  ExecStatus,
  getAttributeOr,
  getBaseAttributes,
  duplicateBaseAttributes,
} from './index.js'

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
): ExecStatus {
  return 'idle'
}

function duplicateYXmlFragment(fragment: Y.XmlFragment): Y.XmlFragment {
  const newFragment = new Y.XmlFragment()

  function cloneElement(element: Y.XmlElement) {
    const newElement = new Y.XmlElement(element.nodeName)
    const attrs = element.getAttributes()
    for (const key in attrs) {
      const value = attrs[key]
      if (value === undefined) {
        continue
      }

      newElement.setAttribute(key, value)
    }

    const children: Array<Y.XmlElement | Y.XmlText | Y.XmlHook> = []
    let child = element.firstChild
    while (child) {
      children.push(cloneNode(child))
      child = child.nextSibling
    }

    // @ts-ignore
    newElement.insert(0, children)

    return newElement
  }

  function cloneNode(node: Y.XmlElement | Y.XmlText | Y.XmlHook) {
    if (node instanceof Y.XmlElement) {
      return cloneElement(node)
    }

    return node.clone()
  }

  // adapted from https://github.com/yjs/yjs/blob/e348255bb125e992eb661889e64a10efd7319172/src/types/YXmlFragment.js#L168-L173
  newFragment.insert(
    0,
    // @ts-ignore
    fragment.toArray().map(cloneNode)
  )

  return newFragment
}
