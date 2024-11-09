import { DataFrame } from '@briefer/types'
import { equals } from 'ramda'
import * as Y from 'yjs'

export * from './executor.js'

export function updateDataframes(
  oldDataframes: Y.Map<DataFrame>,
  newDataframes: DataFrame[],
  currentBlockId: string,
  blocks: Set<string>
) {
  const update = () => {
    const previousDataframes = new Set(Array.from(oldDataframes.keys()))

    const dataframesToUpdate = new Map<string, DataFrame>()
    const dataframesToAdd = new Map(newDataframes.map((df) => [df.name, df]))
    const dataframesToRemove = new Set(previousDataframes)

    newDataframes.forEach((dataframe) => {
      if (dataframesToRemove.has(dataframe.name)) {
        dataframesToRemove.delete(dataframe.name)
      }

      if (oldDataframes.has(dataframe.name)) {
        dataframesToUpdate.set(dataframe.name, dataframe)
        dataframesToAdd.delete(dataframe.name)
      }
    })

    dataframesToRemove.forEach((name) => {
      const df = oldDataframes.get(name)
      if (!df) {
        return
      }

      if (!df.blockId) {
        return
      }

      if (!blocks.has(df.blockId) || df.blockId === currentBlockId) {
        // if df block does not exist anymore or we just ran it's block
        // and it's not defined in python anymore, we can remove it
        oldDataframes.delete(name)
      }
    })

    dataframesToAdd.forEach((df, name) => {
      // set the currentBlockId to the current blockId before adding it
      df.blockId = currentBlockId

      oldDataframes.set(name, df)
    })

    dataframesToUpdate.forEach((df, name) => {
      const previous = oldDataframes.get(name)
      if (!previous) {
        oldDataframes.set(name, df)
        return
      }

      if (equals(previous.columns, df.columns)) {
        return
      }

      if (!df.blockId) {
        df.blockId = currentBlockId
      }
      oldDataframes.set(name, df)
    })
  }

  if (oldDataframes.doc) {
    oldDataframes.doc.transact(update)
  } else {
    update()
  }
}
