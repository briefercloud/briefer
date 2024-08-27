import * as Y from 'yjs'
import { getAttributeOr } from './blocks/index.js'

export type RunAll = {
  type: 'run-all'
  status:
    | 'idle'
    | 'run-requested'
    | 'running'
    | 'abort-requested'
    | 'aborting'
    | 'schedule-running'
  remaining: number
  total: number
}

export type YRunAll = Y.XmlElement<RunAll>

export function isRunAll(el: Y.XmlElement): boolean {
  return el.getAttribute('type') === 'run-all'
}

export function getRunAll(doc: Y.Doc): YRunAll {
  const el = doc.getXmlElement('runAll') as YRunAll

  const defaultAttributes: RunAll = {
    type: 'run-all',
    status: 'idle',
    remaining: 0,
    total: 0,
  }

  for (const [key, value] of Object.entries(defaultAttributes)) {
    if (!el.hasAttribute(key)) {
      el.setAttribute(
        // @ts-ignore
        key,
        value
      )
    }
  }

  return el
}

export function getRunAllAttributes(el: YRunAll): RunAll {
  return {
    type: getAttributeOr(el, 'type', 'run-all'),
    status: getAttributeOr(el, 'status', 'idle'),
    remaining: getAttributeOr(el, 'remaining', 0),
    total: getAttributeOr(el, 'total', 0),
  }
}

export function isRunAllLoading(el: YRunAll): boolean {
  const status = getRunAllAttributes(el).status

  switch (status) {
    case 'idle':
    case undefined:
      return false
    case 'run-requested':
    case 'running':
    case 'abort-requested':
    case 'aborting':
    case 'schedule-running':
      return true
  }
}
