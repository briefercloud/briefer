import * as Y from 'yjs'
import { YBlock } from '@briefer/editor'
import { BlocksObserver } from './index.js'
import { IInputObserver } from './input.js'
import { IPythonObserver } from './python.js'
import { ISQLObserver } from './sql.js'
import { IVisualizationObserver } from './visualization.js'
import { IFileUploadObserver } from './file-upload.js'
import { IDropdownInputObserver } from './dropdown-input.js'
import { IWritebackObserver } from './writeback.js'
import { IDateInputObserver } from './date-input.js'
import { IPivotTableObserver } from './pivot-table.js'

describe('BlocksObserver', () => {
  describe('isIdle', () => {
    let sqlObserver: jest.Mocked<ISQLObserver>
    let pythonObserver: jest.Mocked<IPythonObserver>
    let visualizationObserver: jest.Mocked<IVisualizationObserver>
    let inputObserver: jest.Mocked<IInputObserver>
    let dropdownInputObserver: jest.Mocked<IDropdownInputObserver>
    let dateInputObserver: jest.Mocked<IDateInputObserver>
    let fileUploadObserver: jest.Mocked<IFileUploadObserver>
    let writebackObserver: jest.Mocked<IWritebackObserver>
    let pivotTableObserver: jest.Mocked<IPivotTableObserver>
    let blocks: Y.Map<YBlock>
    let blocksObserver: BlocksObserver
    const doc = new Y.Doc()
    blocks = doc.getMap<YBlock>('blocks')

    sqlObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    pythonObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    visualizationObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    inputObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    dropdownInputObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    dateInputObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    fileUploadObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    writebackObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    pivotTableObserver = {
      isIdle: jest.fn(),
      handleInitialBlockState: jest.fn(),
      handleBlockEvent: jest.fn(),
    }
    blocksObserver = new BlocksObserver(
      'workspace-id',
      'document-id',
      blocks,
      sqlObserver,
      pythonObserver,
      visualizationObserver,
      inputObserver,
      dropdownInputObserver,
      dateInputObserver,
      fileUploadObserver,
      writebackObserver,
      pivotTableObserver,
      {
        blockAdd: jest.fn(),
      }
    )
    const mocks = [
      { name: 'sqlObserver', mock: sqlObserver },
      { name: 'pythonObserver', mock: pythonObserver },
      { name: 'visualizationObserver', mock: visualizationObserver },
      { name: 'inputObserver', mock: inputObserver },
      { name: 'dropdownInputObserver', mock: dropdownInputObserver },
      { name: 'fileUploadObserver', mock: fileUploadObserver },
      { name: 'writebackObserver', mock: writebackObserver },
      { name: 'dateInputObserver', mock: dateInputObserver },
    ]

    const table = []
    let row = []
    for (const sqlIdle of [true, false]) {
      for (const pythonIdle of [true, false]) {
        for (const visualizationIdle of [true, false]) {
          for (const inputIdle of [true, false]) {
            for (const dropdownInputIdle of [true, false]) {
              for (const fileUploadIdle of [true, false]) {
                for (const writebackIdle of [true, false]) {
                  for (const dateInputIdle of [true, false]) {
                    row = [
                      sqlIdle,
                      pythonIdle,
                      visualizationIdle,
                      inputIdle,
                      dropdownInputIdle,
                      fileUploadIdle,
                      writebackIdle,
                      dateInputIdle,
                    ]
                    row.push(row.reduce((acc, curr) => acc && curr, true))
                    table.push(row)
                    row = []
                  }
                }
              }
            }
          }
        }
      }
    }

    for (const row of table) {
      const testName = mocks.map((m, i) => `${m.name} is ${row[i]}`).join(', ')
      it(`should return ${row[row.length - 1]} when ${testName}`, () => {
        mocks.forEach((m, i) => m.mock.isIdle.mockReturnValue(row[i]!))
        expect(blocksObserver.isIdle()).toEqual(row[row.length - 1])
      })
    }
  })
})
