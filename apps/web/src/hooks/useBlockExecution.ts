import {
  Execution,
  ExecutionQueue,
  ExecutionQueueItemMetadataWithoutNoop,
  getBaseAttributes,
  YBlock,
} from '@briefer/editor'
import { useEffect, useState } from 'react'

export function useBlockExecutions(
  queue: ExecutionQueue,
  block: YBlock,
  tag: ExecutionQueueItemMetadataWithoutNoop['_tag']
): Execution[] {
  const blockId = getBaseAttributes(block).id
  const [executions, setExecutions] = useState(
    queue.getBlockExecutions(blockId, tag)
  )

  useEffect(() => {
    const clean = queue.observe(() => {
      setExecutions(queue.getBlockExecutions(blockId, tag))
    })

    return clean
  }, [queue, blockId, tag])

  return executions
}
