import * as dfns from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import * as Y from 'yjs'
import {
  YBlock,
  computeDepencyQueue,
  makeFileUploadBlock,
  makePythonBlock,
  makeRichTextBlock,
} from './index.js'
import { YBlockGroup, makeYBlockGroup } from '../operations/blockGroup.js'

describe('computeDepencyQueue', () => {
  let doc: Y.Doc
  let blocks: Y.Map<YBlock>
  let layout: Y.Array<YBlockGroup>

  beforeEach(() => {
    doc = new Y.Doc()
    blocks = doc.getMap<YBlock>('blocks')
    layout = doc.getArray<YBlockGroup>('layout')
  })

  afterEach(() => {
    doc.destroy()
  })

  it('should return a queue that includes all executable blocks that come before the block that are dirty or have not ran since env started or have a previous block that ran after them', () => {
    const envStartedAt = new Date(
      Date.now() - 1000 * 60 * 60 * 24
    ).toISOString() // 1 day ago

    // ran after env started
    // do not expect this block to be in the queue
    const firstBlockId = 'first-block'
    const firstBlock = makePythonBlock(firstBlockId)
    const firstBlockExecutedAt = dfns.addSeconds(envStartedAt, 1)
    firstBlock.setAttribute('lastQueryTime', firstBlockExecutedAt.toISOString())
    firstBlock.setAttribute('source', new Y.Text('a = 1'))
    firstBlock.setAttribute('lastQuery', 'a = 1')
    blocks.set(firstBlockId, firstBlock)

    // ran before env started
    // expect this block to be in the queue
    const secondBlockId = 'second-block'
    const secondBlock = makePythonBlock(secondBlockId)
    const secondBlockExecutedAt = dfns.subSeconds(envStartedAt, 1)
    secondBlock.setAttribute(
      'lastQueryTime',
      secondBlockExecutedAt.toISOString()
    )
    secondBlock.setAttribute('source', new Y.Text('a = 2'))
    secondBlock.setAttribute('lastQuery', 'a = 2')
    blocks.set(secondBlockId, secondBlock)

    // clicked block
    const clickedBlockId = 'clicked-block'
    const clickedBlock = makePythonBlock(clickedBlockId)
    blocks.set(clickedBlockId, clickedBlock)

    // block after clicked block
    // do not expect this block to be in the queue
    const afterBlockId = 'after-block'
    const afterBlock = makePythonBlock(afterBlockId)
    blocks.set(afterBlockId, afterBlock)

    // non executable blocks that should not be in the queue
    const richTextBlockId = 'rich-text-block'
    const richTextBlock = makeRichTextBlock(richTextBlockId)
    blocks.set(richTextBlockId, richTextBlock)

    const fileUploadBlockId = 'file-upload-block'
    const fileUploadBlock = makeFileUploadBlock(fileUploadBlockId)
    blocks.set(fileUploadBlockId, fileUploadBlock)

    const blockGroupId = uuidv4()
    const blockGroup = makeYBlockGroup(blockGroupId, firstBlockId, [
      secondBlockId,
      richTextBlockId,
      fileUploadBlockId,
      clickedBlockId,
      afterBlockId,
    ])

    layout.push([blockGroup])

    const queue = computeDepencyQueue(
      clickedBlock,
      layout,
      blocks,
      false,
      envStartedAt
    ).map((b) => b.getAttribute('id'))

    const expected = [secondBlock].map((b) => b.getAttribute('id'))

    expect(queue).toEqual(expected)
  })
})
