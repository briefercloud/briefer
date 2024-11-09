import * as Y from 'yjs'
import { DataFrame } from '@briefer/types'
import { updateDataframes } from './index.js'

describe('updateDataframes', () => {
  it('should only update dataframes with new columns', () => {
    const ydoc = new Y.Doc()
    const dataframes = ydoc.getMap<DataFrame>()
    const oldDate = new Date(Date.now() - 1000 * 60).toISOString()
    dataframes.set('keep', {
      name: 'keep',
      columns: [{ name: 'a', type: 'int' }],
      updatedAt: oldDate,
    })
    dataframes.set('remove', {
      name: 'remove',
      columns: [{ name: 'a', type: 'int' }],
      updatedAt: oldDate,
      blockId: 'notInDocumentAnymore',
    })
    dataframes.set('update', {
      name: 'update',
      columns: [{ name: 'a', type: 'int' }],
      updatedAt: oldDate,
    })

    const newDate = new Date().toISOString()
    const newDataframes: DataFrame[] = [
      {
        name: 'keep',
        columns: [{ name: 'a', type: 'int' }],
        updatedAt: newDate,
      },
      {
        name: 'add',
        columns: [{ name: 'a', type: 'int' }],
        updatedAt: newDate,
      },
      {
        name: 'update',
        columns: [{ name: 'b', type: 'int' }],
        updatedAt: newDate,
      },
    ]

    updateDataframes(dataframes, newDataframes, 'blockId', new Set(['blockId']))

    expect(dataframes.get('keep')).toEqual({
      name: 'keep',
      columns: [{ name: 'a', type: 'int' }],
      updatedAt: oldDate,
    })
    expect(dataframes.get('remove')).toBeUndefined()
    expect(dataframes.get('add')).toEqual({
      name: 'add',
      columns: [{ name: 'a', type: 'int' }],
      updatedAt: newDate,
      blockId: 'blockId',
    })
    expect(dataframes.get('update')).toEqual({
      name: 'update',
      columns: [{ name: 'b', type: 'int' }],
      updatedAt: newDate,
      blockId: 'blockId',
    })
    expect(dataframes.size).toBe(3)
  })
})
