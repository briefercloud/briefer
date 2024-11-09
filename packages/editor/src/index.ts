import * as Y from 'yjs'
import {
  BlockType,
  DashboardHeaderBlock,
  FileUploadBlock,
  InputBlock,
  PythonBlock,
  RichTextBlock,
  SQLBlock,
  VisualizationBlock,
  YBlock,
  getInputAttributes,
  getPythonSource,
  getSQLAttributes,
} from './blocks/index.js'
import { YBlockGroup } from './operations/blockGroup.js'
import { DataFrame } from '@briefer/types'
import diff from 'fast-diff'
import {
  DropdownInputBlock,
  getDropdownInputAttributes,
} from './blocks/dropdownInput.js'
import { YDashboardItem } from './dashboard.js'
import { WritebackBlock } from './blocks/writeback.js'
import { DateInputBlock, getDateInputAttributes } from './blocks/dateInput.js'
import { PivotTableBlock } from './blocks/pivotTable.js'

export * from './operations/index.js'
export * from './blocks/index.js'
export * from './run-all.js'
export * from './dashboard.js'
export * from './metadata.js'
export * from './component.js'
export * from './execution/index.js'

export function getBlocks(doc: Y.Doc) {
  const map = doc.getMap<YBlock>('blocks')
  const clean = () => {
    const cleanup: string[] = []
    map.forEach((block, key) => {
      if (!block || !(block instanceof Y.XmlElement)) {
        cleanup.push(key)
      }
    })

    for (const key of cleanup) {
      map.delete(key)
    }
  }

  if (map.doc) {
    map.doc.transact(clean)
  } else {
    clean()
  }

  return map
}

export function getLayout(doc: Y.Doc) {
  return doc.getArray<YBlockGroup>('layout')
}

export function getDataframes(doc: Y.Doc) {
  return doc.getMap<DataFrame>('dataframes')
}

export function getDashboard(doc: Y.Doc) {
  return doc.getMap<YDashboardItem>('dashboard')
}

export function getDocumentSourceWithBlockStartPos(
  doc: Y.Doc,
  blockId: string
) {
  const layout = getLayout(doc)
  const blocks = getBlocks(doc)
  let blockStartPos = 0
  let source = ''
  for (const group of layout) {
    const tabs = group.getAttribute('tabs')
    if (!tabs) {
      continue
    }

    for (const tab of tabs) {
      const id = tab.getAttribute('id')
      if (!id) {
        continue
      }

      const block = blocks.get(id)
      if (!block) {
        continue
      }

      switchBlockType(block, {
        onPython: (block) => {
          if (source !== '') {
            source += '\n'
          }

          if (blockId === id) {
            blockStartPos = source.length
          }

          source += getPythonSource(block).toJSON()
        },
        onSQL: (block) => {
          if (source !== '') {
            source += '\n'
          }

          if (blockId === id) {
            blockStartPos = source.length
          }

          const attr = getSQLAttributes(block, blocks)
          attr.dataframeName.value
          source += `import pandas as pd\n${attr.dataframeName.value} = pd.DataFrame()`
        },
        onInput: (block) => {
          if (source !== '') {
            source += '\n'
          }

          if (blockId === id) {
            blockStartPos = source.length
          }

          const attrs = getInputAttributes(block, blocks)
          attrs.variable.value
          source += `${attrs.variable.value} = ${JSON.stringify(
            attrs.value.value
          )}`
        },
        onDropdownInput: (block) => {
          if (source !== '') {
            source += '\n'
          }

          if (blockId === id) {
            blockStartPos = source.length
          }

          const attrs = getDropdownInputAttributes(block, blocks)
          attrs.variable.value
          source += `${attrs.variable.value} = ${JSON.stringify(
            attrs.value.value
          )}`
        },
        onDateInput: (block) => {
          if (source !== '') {
            source += '\n'
          }

          if (blockId === id) {
            blockStartPos = source.length
          }

          const attrs = getDateInputAttributes(block, blocks)
          source += `import pytz
from datetime import datetime
${attrs.variable} = pytz.timezone('${attrs.value.timezone}').localize(datetime.datetime(${attrs.value.year}, ${attrs.value.month}, ${attrs.value.day}, ${attrs.value.hours}, ${attrs.value.minutes}, ${attrs.value.seconds}))`
        },
        onRichText: () => {},
        onVisualization: () => {},
        onFileUpload: () => {},
        onDashboardHeader: () => {},
        onWriteback: () => {},
        onPivotTable: () => {},
      })
    }
  }

  return { source, blockStartPos }
}

export function getLastUpdatedAt(doc: Y.Doc): string | null {
  const blocks = getBlocks(doc)
  let lastUpdatedAt: string | null = null

  blocks.forEach((block) => {
    switchBlockType(block, {
      onPython: (block) => {
        const queryTime = block.getAttribute('lastQueryTime')
        if (queryTime && (!lastUpdatedAt || queryTime > lastUpdatedAt)) {
          lastUpdatedAt = queryTime
        }
      },
      onSQL: (block) => {
        const queryTime = block.getAttribute('lastQueryTime')
        if (queryTime && (!lastUpdatedAt || queryTime > lastUpdatedAt)) {
          lastUpdatedAt = queryTime
        }
      },
      onInput: (block) => {
        const updatedAt = block.getAttribute('executedAt')
        if (updatedAt && (!lastUpdatedAt || updatedAt > lastUpdatedAt)) {
          lastUpdatedAt = updatedAt
        }
      },
      onDropdownInput: (block) => {
        const updatedAt = block.getAttribute('executedAt')
        if (updatedAt && (!lastUpdatedAt || updatedAt > lastUpdatedAt)) {
          lastUpdatedAt = updatedAt
        }
      },
      onDateInput: (block) => {
        const updatedAt = block.getAttribute('executedAt')
        if (updatedAt && (!lastUpdatedAt || updatedAt > lastUpdatedAt)) {
          lastUpdatedAt = updatedAt
        }
      },
      onVisualization: (block) => {
        const updatedAt = block.getAttribute('updatedAt')
        if (updatedAt && (!lastUpdatedAt || updatedAt > lastUpdatedAt)) {
          lastUpdatedAt = updatedAt
        }
      },
      onRichText: () => {},
      onFileUpload: () => {},
      onDashboardHeader: () => {},
      onWriteback: (block) => {
        const result = block.getAttribute('result')
        if (result && (!lastUpdatedAt || result.executedAt > lastUpdatedAt)) {
          lastUpdatedAt = result.executedAt
        }
      },
      onPivotTable: (block) => {
        const updatedAt = block.getAttribute('updatedAt')
        if (updatedAt && (!lastUpdatedAt || updatedAt > lastUpdatedAt)) {
          lastUpdatedAt = updatedAt
        }
      },
    })
  })

  return lastUpdatedAt
}

export function switchBlockType<T>(
  block: YBlock,
  handles: {
    onRichText: (block: Y.XmlElement<RichTextBlock>) => T
    onSQL: (block: Y.XmlElement<SQLBlock>) => T
    onPython: (block: Y.XmlElement<PythonBlock>) => T
    onVisualization: (block: Y.XmlElement<VisualizationBlock>) => T
    onInput: (block: Y.XmlElement<InputBlock>) => T
    onDropdownInput: (block: Y.XmlElement<DropdownInputBlock>) => T
    onDateInput: (block: Y.XmlElement<DateInputBlock>) => T
    onFileUpload: (block: Y.XmlElement<FileUploadBlock>) => T
    onDashboardHeader: (block: Y.XmlElement<DashboardHeaderBlock>) => T
    onWriteback: (block: Y.XmlElement<WritebackBlock>) => T
    onPivotTable: (block: Y.XmlElement<PivotTableBlock>) => T
  }
): T {
  const type = block.getAttribute('type') as BlockType
  switch (type) {
    case BlockType.RichText:
      return handles.onRichText(block as Y.XmlElement<RichTextBlock>)
    case BlockType.SQL:
      return handles.onSQL(block as Y.XmlElement<SQLBlock>)
    case BlockType.Python:
      return handles.onPython(block as Y.XmlElement<PythonBlock>)
    case BlockType.Visualization:
      return handles.onVisualization(block as Y.XmlElement<VisualizationBlock>)
    case BlockType.Input:
      return handles.onInput(block as Y.XmlElement<InputBlock>)
    case BlockType.DropdownInput:
      return handles.onDropdownInput(block as Y.XmlElement<DropdownInputBlock>)
    case BlockType.DateInput:
      return handles.onDateInput(block as Y.XmlElement<DateInputBlock>)
    case BlockType.FileUpload:
      return handles.onFileUpload(block as Y.XmlElement<FileUploadBlock>)
    case BlockType.DashboardHeader:
      return handles.onDashboardHeader(
        block as Y.XmlElement<DashboardHeaderBlock>
      )
    case BlockType.Writeback:
      return handles.onWriteback(block as Y.XmlElement<WritebackBlock>)
    case BlockType.PivotTable:
      return handles.onPivotTable(block as Y.XmlElement<PivotTableBlock>)
  }
}

export function updateYText(yText: Y.Text, next: string) {
  const operation = () => {
    const prev = yText.toString()
    const changes = diff(prev, next)
    let index = 0

    for (const change of changes) {
      switch (change[0]) {
        case diff.DELETE:
          yText.delete(index, change[1].length)
          break
        case diff.INSERT:
          yText.insert(index, change[1])
          index += change[1].length
          break
        case diff.EQUAL:
          index += change[1].length
          break
      }
    }
  }

  if (yText.doc) {
    yText.doc.transact(operation)
  } else {
    operation()
  }
}

export function compareText(
  a: Y.Text | undefined | null,
  b: Y.Text | undefined | null
): number {
  if (!a && !b) {
    return 0
  }

  if (!a) {
    return -1
  }

  if (!b) {
    return 1
  }

  return a.toJSON().localeCompare(b.toJSON())
}

export function getDataframe(
  block: Y.XmlElement<VisualizationBlock | PivotTableBlock>,
  dataframes: Y.Map<DataFrame>
) {
  const dfName = block.getAttribute('dataframeName')
  if (!dfName) {
    return null
  }

  const df = dataframes.get(dfName)
  if (!df) {
    const firstDf = Array.from(dataframes.values())[0]
    if (firstDf) {
      block.setAttribute('dataframeName', firstDf.name)
    } else {
      block.setAttribute('dataframeName', null)
    }

    return firstDf ?? null
  }

  return df ?? null
}
