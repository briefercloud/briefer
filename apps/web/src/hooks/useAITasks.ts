import {
  AITaskItem,
  AITaskItemMetadataWithoutNoop,
  AITasks,
  getBaseAttributes,
  YBlock,
} from '@briefer/editor'
import { useEffect, useState } from 'react'

export function useAITasks(
  aiTasks: AITasks,
  block?: YBlock,
  tag?: AITaskItemMetadataWithoutNoop['_tag']
): AITaskItem[] {
  const blockId = block ? getBaseAttributes(block).id : ''
  const [tasks, setTasks] = useState(() => aiTasks.getBlockTasks(blockId, tag))

  useEffect(() => {
    const clean = aiTasks.observe(() => {
      setTasks(aiTasks.getBlockTasks(blockId, tag))
    })

    return clean
  }, [aiTasks, blockId, tag])

  return tasks
}
