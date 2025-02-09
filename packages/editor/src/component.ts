import { v4 as uuidv4 } from 'uuid'
import * as Y from 'yjs'
import { PythonBlock, SQLBlock, YBlock } from './blocks/index.js'
import {
  appendBlock,
  duplicateBlock,
  duplicateYText,
  getBaseAttributes,
  getBlocks,
  getLayout,
  getPythonAttributes,
  getSQLAttributes,
  isPythonBlock,
  isSQLBlock,
} from './index.js'
import { clone } from 'ramda'

const MAP_KEY = 'blocks'

export function createComponentState(
  component: Y.XmlElement<SQLBlock | PythonBlock>,
  blocks: Y.Map<YBlock>
): { id: string; state: string } {
  const ydoc = new Y.Doc()
  const map = ydoc.getMap<YBlock>(MAP_KEY)
  const blockId = getBaseAttributes(component).id
  let componentId = component.getAttribute('componentId')
  if (!componentId) {
    componentId = uuidv4()
    component.setAttribute('componentId', componentId)
  }
  map.set('component', duplicateBlock(blockId, component, blocks, false))

  return {
    id: componentId,
    state: Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64'),
  }
}

export function decodeComponentState<T extends SQLBlock | PythonBlock>(
  state: string
): Y.XmlElement<T> {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, Buffer.from(state, 'base64'))
  const map = ydoc.getMap<Y.XmlElement<T>>(MAP_KEY)
  return map.get('component')!
}

type SQLComponentAttrs = Omit<
  SQLBlock,
  // the reason we exclude them manually is to make sure the compiler
  // will complain if we add new attributes to SQLBlock and forget to
  // exclude them here if they are not supposed to be part of the component
  | 'id'
  | 'index'
  | 'type'
  | 'status'
  | 'selectedCode'
  | 'result'
  | 'lastQuery'
  | 'lastQueryTime'
  | 'startQueryTime'
  | 'isCodeHidden'
  | 'isResultHidden'
  | 'editWithAIPrompt'
  | 'isEditWithAIPromptOpen'
  | 'aiSuggestions'
  | 'componentId'
>

type PythonComponentAttrs = Omit<
  PythonBlock,
  // the reason we exclude them manually is to make sure the compiler
  // will complain if we add new attributes to PythonBlock and forget to
  // exclude them here if they are not supposed to be part of the component
  | 'id'
  | 'index'
  | 'type'
  | 'status'
  | 'result'
  | 'isResultHidden'
  | 'isCodeHidden'
  | 'lastQuery'
  | 'lastQueryTime'
  | 'startQueryTime'
  | 'editWithAIPrompt'
  | 'isEditWithAIPromptOpen'
  | 'aiSuggestions'
  | 'componentId'
>
export function updateBlockFromComponent(
  component: YBlock,
  block: YBlock,
  blocks: Y.Map<YBlock>
): boolean {
  if (isSQLBlock(block) && isSQLBlock(component)) {
    const compAttrs = getSQLAttributes(component, blocks)
    const nextAttrs: SQLComponentAttrs = {
      title: clone(compAttrs.title),
      source: duplicateYText(compAttrs.source),
      dataframeName: clone(compAttrs.dataframeName),
      dataSourceId: compAttrs.dataSourceId,
      isFileDataSource: compAttrs.isFileDataSource,
      configuration: clone(compAttrs.configuration),
      page: compAttrs.page,
      dashboardPage: compAttrs.dashboardPage,
      dashboardPageSize: compAttrs.dashboardPageSize,
      sort: clone(compAttrs.sort),
    }
    for (const [key, value] of Object.entries(nextAttrs)) {
      block.setAttribute(
        // @ts-ignore
        key,
        value
      )
    }
    return true
  }

  if (isPythonBlock(block) && isPythonBlock(component)) {
    const compAttrs = getPythonAttributes(component)

    const nextAttributes: PythonComponentAttrs = {
      title: clone(compAttrs.title),
      source: duplicateYText(compAttrs.source),
    }

    for (const [key, value] of Object.entries(nextAttributes)) {
      block.setAttribute(
        // @ts-ignore
        key,
        value
      )
    }
    return true
  }

  return false
}

export function addComponentToDocument(
  component: Y.XmlElement<SQLBlock | PythonBlock>,
  newBlockId: string,
  doc: Y.Doc
) {
  const componentId = component.getAttribute('componentId')
  if (!componentId) {
    return
  }

  const layout = getLayout(doc)
  const blocks = getBlocks(doc)
  const block = duplicateBlock(newBlockId, component, blocks, false, {
    componentId,
    noState: true,
  })
  appendBlock(newBlockId, block, blocks, layout)
}
