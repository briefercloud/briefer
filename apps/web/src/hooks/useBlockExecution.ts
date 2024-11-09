import {
  Execution,
  ExecutionQueue,
  getBaseAttributes,
  YBlock,
} from '@briefer/editor'
import { useEffect, useState } from 'react'

export function useBlockExecutions(
  queue: ExecutionQueue,
  block: YBlock
): Execution[] {
  const blockId = getBaseAttributes(block).id
  const [executions, setExecutions] = useState(
    queue.getBlockExecutions(blockId)
  )

  useEffect(() => {
    console.log(JSON.stringify(queue, null, 2))
    const clean = queue.observe(() => {
      console.log(JSON.stringify(queue, null, 2))
      setExecutions(queue.getBlockExecutions(blockId))
    })

    return clean
  }, [queue, blockId])

  return executions
}
