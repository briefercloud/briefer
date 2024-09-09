import * as Y from 'yjs'
import { BaseBlock, BlockType, YBlock } from '../index.js'

export type DashboardHeaderBlock = BaseBlock<BlockType.DashboardHeader> & {
  content: string
}

export const makeDashboardHeaderBlock = (
  id: string,
  init?: Partial<DashboardHeaderBlock>
): Y.XmlElement<DashboardHeaderBlock> => {
  const yBlock = new Y.XmlElement<DashboardHeaderBlock>('block')

  // Why do we use index in the base block?
  const attrs: DashboardHeaderBlock = {
    index: null,
    id: id,
    type: BlockType.DashboardHeader,
    title: '',
    content: '',
    ...(init ?? {}),
  }

  for (const [key, value] of Object.entries(attrs)) {
    yBlock.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }

  return yBlock
}

export function duplicateDashboardHeaderBlock(
  newId: string,
  block: Y.XmlElement<DashboardHeaderBlock>
): Y.XmlElement<DashboardHeaderBlock> {
  return makeDashboardHeaderBlock(newId, block.getAttributes())
}
