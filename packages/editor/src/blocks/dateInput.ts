import { parse, isValid } from 'date-fns'
import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  YBlock,
  getAttributeOr,
  getBaseAttributes,
  ExecStatus,
  duplicateBaseAttributes,
} from './index.js'
import { updateYText } from '../index.js'
import { clone } from 'ramda'

export type DateInputValue = {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
  timezone: string
}

export function dateInputValueFromDate(
  date: Date,
  timezone: string
): DateInputValue {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    timezone,
  }
}

export function dateInputValueFromString(
  str: string,
  value: DateInputValue
): DateInputValue {
  const parsedYear = parse(str.slice(0, 4), 'yyyy', new Date(value.year))
  const year = isValid(parsedYear) ? parsedYear.getFullYear() : value.year

  const parsedMonth = parse(
    str.slice(0, 7),
    'yyyy/MM',
    new Date(value.year, value.month - 1)
  )
  const month = isValid(parsedMonth) ? parsedMonth.getMonth() + 1 : value.month

  const parsedDay = parse(
    str.slice(0, 10),
    'yyyy/MM/dd',
    new Date(value.year, value.month - 1, value.day)
  )
  const day = isValid(parsedDay) ? parsedDay.getDate() : value.day

  const parsedHours = parse(
    str.slice(0, 13),
    'yyyy/MM/dd HH',
    new Date(value.year, value.month - 1, value.day, value.hours)
  )
  const hours = isValid(parsedHours) ? parsedHours.getHours() : value.hours

  const parsedMinutes = parse(
    str.slice(0, 16),
    'yyyy/MM/dd HH:mm',
    new Date(value.year, value.month - 1, value.day, value.hours, value.minutes)
  )
  const minutes = isValid(parsedMinutes)
    ? parsedMinutes.getMinutes()
    : value.minutes

  const parsedSeconds = parse(
    str,
    'yyyy/MM/dd HH:mm:ss',
    new Date(
      value.year,
      value.month - 1,
      value.day,
      value.hours,
      value.minutes,
      value.seconds
    )
  )
  const seconds = isValid(parsedSeconds)
    ? parsedSeconds.getSeconds()
    : value.seconds

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    timezone: value.timezone,
  }
}

export function formatDateInputValue(
  dateInputValue: DateInputValue,
  dateType: 'date' | 'datetime'
): string {
  const date = `${dateInputValue.year}/${dateInputValue.month
    .toString()
    .padStart(2, '0')}/${dateInputValue.day.toString().padStart(2, '0')}`
  if (dateType === 'date') {
    return date
  }

  const time = `${dateInputValue.hours
    .toString()
    .padStart(2, '0')}:${dateInputValue.minutes
    .toString()
    .padStart(2, '0')}:${dateInputValue.seconds.toString().padStart(2, '0')}`

  return `${date} ${time}`
}

export type DateInputBlock = BaseBlock<BlockType.DateInput> & {
  label: Y.Text
  status:
    | 'idle'
    | 'run-requested'
    | 'running'
    | 'run-all-enqueued'
    | 'run-all-running'
    | 'invalid-value'
    | 'invalid-variable'
    | 'invalid-variable-and-value'
    | 'unexpected-error'
  variable: string
  value: {
    year: number
    month: number
    day: number
    hours: number
    minutes: number
    seconds: number
    timezone: string
  }
  executedAt: string | null
  configOpen: boolean
  dateType: 'date' | 'datetime'
  newValue: Y.Text
  newVariable: Y.Text
}

export const makeDateInputBlock = (
  id: string,
  blocks: Y.Map<YBlock>
): Y.XmlElement<DateInputBlock> => {
  const yBlock = new Y.XmlElement<DateInputBlock>('block')

  const now = new Date()
  const variable = getAvailableDateInputVariable(blocks)
  const value = dateInputValueFromDate(now, 'UTC')
  const attrs: DateInputBlock = {
    id,
    status: 'idle',
    index: null,
    title: '',
    type: BlockType.DateInput,
    label: getLabelFromVariable(variable),
    value,
    newValue: new Y.Text(formatDateInputValue(value, 'date')),
    variable,
    newVariable: new Y.Text(variable),
    executedAt: null,
    configOpen: true,
    dateType: 'date',
  }

  for (const [key, value] of Object.entries(attrs)) {
    yBlock.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }

  return yBlock
}

export function duplicateDateInputBlock(
  newId: string,
  block: Y.XmlElement<DateInputBlock>,
  blocks: Y.Map<YBlock>
): Y.XmlElement<DateInputBlock> {
  const prevAttributes = getDateInputAttributes(block, blocks)

  const nextAttrs: DateInputBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    label: new Y.Text(prevAttributes.label.toString()),
    status: prevAttributes.status,
    variable: prevAttributes.variable,
    newVariable: new Y.Text(prevAttributes.newVariable.toString()),
    value: clone(prevAttributes.value),
    newValue: new Y.Text(prevAttributes.newValue.toString()),
    executedAt: null,
    configOpen: prevAttributes.configOpen,
    dateType: prevAttributes.dateType,
  }

  const yBlock = new Y.XmlElement<DateInputBlock>('block')
  for (const [key, value] of Object.entries(nextAttrs)) {
    yBlock.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }

  return yBlock
}

export function getDateInputBlockExecStatus(
  block: Y.XmlElement<DateInputBlock>
): ExecStatus {
  const status = getAttributeOr(block, 'status', 'idle')
  switch (status) {
    case 'idle':
      return 'idle'
    case 'run-all-enqueued':
      return 'enqueued'
    case 'run-all-running':
      return 'loading'
    case 'run-requested':
    case 'running':
      return 'loading'
    case 'invalid-value':
    case 'invalid-variable':
    case 'invalid-variable-and-value':
    case 'unexpected-error':
      return 'error'
  }
}

export function isDateInputBlock(
  block: YBlock
): block is Y.XmlElement<DateInputBlock> {
  return block.getAttribute('type') === BlockType.DateInput
}

export function getDateInputAttributes(
  block: Y.XmlElement<DateInputBlock>,
  blocks: Y.Map<YBlock>
): DateInputBlock {
  const baseAttrs = getBaseAttributes<BlockType.DateInput>(block)

  const variable = getAttributeOr(
    block,
    'variable',
    getDateInputVariable(block, blocks)
  )
  const now = new Date()
  const value = getAttributeOr(block, 'value', {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds(),
    timezone: 'UTC',
  })
  const dateType = getAttributeOr(block, 'dateType', 'date')

  const attrs: DateInputBlock = {
    ...baseAttrs,
    label: getAttributeOr(block, 'label', getLabelFromVariable(variable)),
    status: getAttributeOr(block, 'status', 'idle'),
    value,
    newValue: getAttributeOr(
      block,
      'newValue',
      new Y.Text(formatDateInputValue(value, dateType))
    ),
    variable,
    newVariable: getAttributeOr(block, 'newVariable', new Y.Text(variable)),
    executedAt: getAttributeOr(block, 'executedAt', null),
    configOpen: getAttributeOr(block, 'configOpen', true),
    dateType,
  }

  return attrs
}

export function getDateInputBlockExecutedAt(
  block: Y.XmlElement<DateInputBlock>,
  blocks: Y.Map<YBlock>
): Date | null {
  const raw = getDateInputAttributes(block, blocks).executedAt
  if (!raw) {
    return null
  }

  return new Date(raw)
}

export function getDateInputBlockFormatStr(
  dateType: 'date' | 'datetime'
): string {
  switch (dateType) {
    case 'datetime':
      return 'yyyy/MM/dd HH:mm:ss'
    case 'date':
      return 'yyyy/MM/dd'
  }
}

function getDateInputVariable(
  block: Y.XmlElement<DateInputBlock>,
  blocks: Y.Map<YBlock>
): DateInputBlock['variable'] {
  let variable = block.getAttribute('variable')
  if (variable) {
    return variable
  }

  variable = getAvailableDateInputVariable(blocks)
  block.setAttribute('variable', variable)
  return variable
}

function getLabelFromVariable(variable: string): DateInputBlock['label'] {
  return new Y.Text(
    variable
      ? variable.charAt(0).toUpperCase() + variable.slice(1).replace('_', ' ')
      : 'Date Input'
  )
}

function getAvailableDateInputVariable(
  blocks: Y.Map<YBlock>
): DateInputBlock['variable'] {
  const inputBlocks = Array.from(blocks.values()).filter(isDateInputBlock)
  const vars = new Set(
    inputBlocks.map((block) => block.getAttribute('variable'))
  )

  let i = 1
  while (vars.has(`date_${i}`)) {
    i++
  }

  return `date_${i}`
}

export function requestDateInputRun(
  block: Y.XmlElement<DateInputBlock>,
  blocks: Y.Map<YBlock>
): void {
  const operation = () => {
    const attrs = getDateInputAttributes(block, blocks)

    const formatStr = getDateInputBlockFormatStr(attrs.dateType)
    const newValue = attrs.newValue.toString()
    const newDate = parse(newValue, formatStr, new Date(0))
    const nextValue = dateInputValueFromDate(newDate, attrs.value.timezone)
    const invalidValue = !isValid(newDate)

    const nextVariable = attrs.newVariable.toString()
    const dfNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    const invalidVariable = !dfNameRegex.test(nextVariable)

    if (invalidValue && invalidVariable) {
      block.setAttribute('status', 'invalid-variable-and-value')
      return
    }
    if (invalidValue) {
      block.setAttribute('status', 'invalid-value')
      return
    }
    if (invalidVariable) {
      block.setAttribute('status', 'invalid-variable')
      return
    }

    block.setAttribute('variable', nextVariable)
    block.setAttribute('value', nextValue)
    block.setAttribute('status', 'run-requested')
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function updateDateInputBlockTimeZone(
  block: Y.XmlElement<DateInputBlock>,
  blocks: Y.Map<YBlock>,
  timezone: string
): void {
  const operation = () => {
    const attrs = getDateInputAttributes(block, blocks)
    block.setAttribute('value', { ...attrs.value, timezone })
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function updateDateInputBlockDateType(
  block: Y.XmlElement<DateInputBlock>,
  blocks: Y.Map<YBlock>,
  dateType: 'date' | 'datetime'
): void {
  const operation = () => {
    const attrs = getDateInputAttributes(block, blocks)
    // need to update newValue
    block.setAttribute('dateType', dateType)
    updateYText(attrs.newValue, formatDateInputValue(attrs.value, dateType))
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}
