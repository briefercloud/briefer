import { z } from 'zod'
import { validate as validateUUID } from 'uuid'
import { parse, parseISO, parseJSON, isValid } from 'date-fns'

export const uuidSchema = z.string().refine((uuid) => validateUUID(uuid), {
  message: 'Invalid UUID format',
})

export const base64Schema = z.string().refine((base64) => {
  try {
    Buffer.from(base64, 'base64')
    return true
  } catch {
    return false
  }
})

// List of date format strings commonly returned by databases
const dateFormatStrings = [
  'yyyy-MM-dd',
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm:ss.SSS',
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd'T'HH:mm:ss.SSS",
  "yyyy-MM-dd'T'HH:mm:ssXXX",
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  'HH:mm:ss',
  'HH:mm:ss.SSS',
  "yyyy-MM-dd'T'HH:mm:ss'Z'",
  "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
  // Add more date format strings here
]

export function toDate(dateString: string): Date | undefined {
  const date = parseISO(dateString)
  if (isValid(date)) {
    return date
  }

  const jsonDate = parseJSON(dateString)
  if (isValid(jsonDate)) {
    return jsonDate
  }

  for (const formatString of dateFormatStrings) {
    const parsedDate = parse(dateString, formatString, new Date())
    if (isValid(parsedDate)) {
      return parsedDate
    }
  }

  return undefined
}

export const dateSchema = z
  .string()
  .refine((date) => toDate(date) !== undefined, {
    message: 'Invalid date format',
  })

export const NumpyIntegerTypes = z.enum([
  'byte',
  'ubyte',

  'short',
  'ushort',

  'i1',
  'i2',
  'i4',
  'i8',

  'int0',
  'int',
  'Int',
  'int8',
  'Int8',
  'int16',
  'Int16',
  'int32',
  'Int32',
  'int64',
  'Int64',

  'long',

  'longlong',

  'u1',
  'u2',
  'u4',
  'u8',

  'uint0',
  'uint8',
  'uint16',
  'uint32',
  'uint64',

  'UInt0',
  'UInt8',
  'UInt16',
  'UInt32',
  'UInt64',

  'uint',
  'UInt',

  'ulong',
  'ULong',

  'ulonglong',
  'ULongLong',
])

// all numpy number types
export const NumpyNumberTypes = z.enum([
  ...NumpyIntegerTypes.options,
  'f2',
  'f4',
  'f8',
  'f16',

  'float16',
  'float32',
  'float64',
  'float128',

  'Float',
  'Float16',
  'Float32',
  'Float64',

  'float',
  'longfloat',

  'double',
  'longdouble',
])

export type NumpyNumberTypes = z.infer<typeof NumpyNumberTypes>

// all numpy date types
export const NumpyDateTypes = z.enum([
  'dbdate',
  'dbtime',
  'datetime64',
  'datetime64[ns]',
  'datetime64[ns, UTC]',
  'datetime64[ns, Etc/UTC]',
  'datetime64[us]',
  'datetime64[us, UTC]',
  'datetime64[us, Etc/UTC]',
  'period',
  'period[Y-DEC]',
  'period[Q-DEC]',
  'period[M]',
  'period[Q]',
  'period[W]',
  'period[D]',
  'period[h]',
  'period[min]',
  'period[m]',
  'period[s]',
  'period[ms]',
  'period[us]',
  'period[ns]',
])
export type NumpyDateTypes = z.infer<typeof NumpyDateTypes>

// all numpy timedelta types
export const NumpyTimeDeltaTypes = z.enum([
  'timedelta64',
  'timedelta64[ns]',
  'timedelta64[ns, UTC]',
  'timedelta64[us]',
  'timedelta64[us, UTC]',
])
export type NumpyTimeDeltaTypes = z.infer<typeof NumpyTimeDeltaTypes>

// all numpy string types
export const NumpyStringTypes = z.enum([
  'string',
  'unicode',
  'str',
  'bytes',
  'bytes0',
  'str0',
  'str',
  'bytes',
  'category',
])
export type NumpyStringTypes = z.infer<typeof NumpyStringTypes>

// all numpy json types
export const NumpyJsonTypes = z.enum(['object', 'object0'])
export type NumpyJsonTypes = z.infer<typeof NumpyJsonTypes>

// all numpy bool types
export const NumpyBoolTypes = z.enum(['bool', 'bool8', 'b1', 'boolean'])
export type NumpyBoolTypes = z.infer<typeof NumpyBoolTypes>

export const DataFrameNumberColumn = z.object({
  name: z.union([z.string(), z.number()]),
  type: NumpyNumberTypes.or(NumpyTimeDeltaTypes),
})
export type DataFrameNumberColumn = z.infer<typeof DataFrameNumberColumn>

export const DataFrameStringColumn = z.object({
  name: z.union([z.string(), z.number()]),
  type: NumpyStringTypes.or(NumpyJsonTypes),
  categories: z.array(z.string().or(z.number()).or(z.boolean())).optional(),
})
export type DataFrameStringColumn = z.infer<typeof DataFrameStringColumn>

export const DataFrameDateColumn = z.object({
  name: z.union([z.string(), z.number()]),
  type: NumpyDateTypes,
})
export type DataFrameDateColumn = z.infer<typeof DataFrameDateColumn>

export const DataFrameBooleanColumn = z.object({
  name: z.union([z.string(), z.number()]),
  type: NumpyBoolTypes,
})
export type DataFrameBooleanColumn = z.infer<typeof DataFrameBooleanColumn>

export const DataFrameColumn = z.union([
  DataFrameNumberColumn,
  DataFrameStringColumn,
  DataFrameDateColumn,
  DataFrameBooleanColumn,
])
export type DataFrameColumn = z.infer<typeof DataFrameColumn>

export const DataFrame = z.object({
  id: z.optional(uuidSchema),
  name: z.string(),
  columns: z.array(DataFrameColumn),
  updatedAt: z.string().optional(),
  blockId: z.string().optional(),
})
export type DataFrame = z.infer<typeof DataFrame>

export const AIEditPythonPayload = z.object({
  documentId: z.string(),
  source: z.string(),
  instructions: z.string(),
  dataFrames: z.array(DataFrame),
})
export type AIEditPythonPayload = z.infer<typeof AIEditPythonPayload>

export const PythonErrorOutput = z.object({
  type: z.literal('error'),
  ename: z.string(),
  evalue: z.string(),
  traceback: z.array(z.string()),
})
export type PythonErrorOutput = z.infer<typeof PythonErrorOutput>

export const PythonHTMLOutput = z.object({
  type: z.literal('html'),
  html: z.string(),
})
export type PythonHTMLOutput = z.infer<typeof PythonHTMLOutput>

export const PythonPlotlyOutput = z.object({
  type: z.literal('plotly'),
  data: z.any(),
  layout: z.any(),
  frames: z.any().optional(),
})
export type PythonPlotlyOutput = z.infer<typeof PythonPlotlyOutput>

export const Output = z.union([
  PythonErrorOutput,
  z.object({
    type: z.literal('stdio'),
    name: z.enum(['stdout', 'stderr']),
    text: z.string(),
  }),
  PythonHTMLOutput,
  PythonPlotlyOutput,
  z.object({
    type: z.literal('image'),
    format: z.enum(['png']),
    data: z.string(),
  }),
])

export type Output = z.infer<typeof Output>

export const JsonLiteral = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

export type JsonLiteral = z.infer<typeof JsonLiteral>
export type JsonObject = { [key: string]: Json }
export type Json = JsonLiteral | JsonObject | Json[]

export const Json: z.ZodType<Json> = z.lazy(() =>
  z.union([JsonLiteral, z.array(Json), z.record(Json)])
)

export const JsonObject = z.record(z.string(), Json)

export const SuccessRunQueryResultV1 = z.object({
  type: z.literal('success'),
  columns: z.array(DataFrameColumn),
  rows: z.array(z.record(z.string(), Json)),
  count: z.number(),
  durationMs: z.number().optional(),
})
export type SuccessRunQueryResultV1 = z.infer<typeof SuccessRunQueryResultV1>

export const SuccessRunQueryResultV2 = z.object({
  version: z.literal(2),

  type: z.literal('success'),
  columns: z.array(DataFrameColumn),
  rows: z.array(z.record(z.string(), Json)),
  count: z.number(),

  // page is 0-indexed
  page: z.number(),
  pageSize: z.number(),
  pageCount: z.number(),

  queryDurationMs: z.number().optional(),
})
export type SuccessRunQueryResultV2 = z.infer<typeof SuccessRunQueryResultV2>

export const SuccessRunQueryResultV3 = z.object({
  version: z.literal(3),

  type: z.literal('success'),
  columns: z.array(DataFrameColumn),
  rows: z.array(z.record(z.string(), Json)),
  count: z.number(),

  // page is 0-indexed
  page: z.number(),
  pageSize: z.number(),
  pageCount: z.number(),

  dashboardPage: z.number(),
  dashboardPageSize: z.number(),
  dashboardPageCount: z.number(),
  dashboardRows: z.array(z.record(z.string(), Json)),

  queryDurationMs: z.number().optional(),
})
export type SuccessRunQueryResultV3 = z.infer<typeof SuccessRunQueryResultV3>

export const SuccessRunQueryResult = z.union([
  SuccessRunQueryResultV1,
  SuccessRunQueryResultV2,
  SuccessRunQueryResultV3,
])
export type SuccessRunQueryResult = z.infer<typeof SuccessRunQueryResult>

export function migrateSuccessSQLResult(
  current: SuccessRunQueryResult
): SuccessRunQueryResultV3 {
  if (!('version' in current)) {
    const v2: SuccessRunQueryResultV2 = {
      version: 2,
      type: 'success',
      columns: current.columns,
      rows: current.rows,
      count: current.count,
      page: 0,
      pageSize: 50,
      pageCount: 1,
      queryDurationMs: current.durationMs,
    }

    return migrateSuccessSQLResult(v2)
  }

  switch (current.version) {
    case 2: {
      const pageSize = 50
      const dashboardPageSize = 6
      const dashboardPageCount =
        current.count > 0 ? Math.ceil(current.count / dashboardPageSize) : 1

      const page = current.page
      // compute equivalent dashboardPage, pageSize for v2 is always 50
      let dashboardPage = Math.floor((page * pageSize) / dashboardPageSize)
      const dashboardRows = current.rows.slice(
        dashboardPage * dashboardPageSize,
        (dashboardPage + 1) * dashboardPageSize
      )
      if (dashboardRows.length === 0) {
        dashboardPage = 0
      }

      return {
        version: 3,
        type: 'success',
        columns: current.columns,
        rows: current.rows.slice(0, pageSize),
        count: current.count,
        page,
        pageSize: current.pageSize,
        pageCount: current.pageCount,
        dashboardPage,
        dashboardPageCount,
        dashboardPageSize,
        dashboardRows,
      }
    }
    case 3:
      return current
  }
}

const AbortErrorRunQueryResult = z.object({
  type: z.literal('abort-error'),
  message: z.string(),
})

export type AbortErrorRunQueryResult = z.infer<typeof AbortErrorRunQueryResult>

const SyntaxErrorRunQueryResult = z.object({
  type: z.literal('syntax-error'),
  message: z.string(),
})

export type SyntaxErrorRunQueryResult = z.infer<
  typeof SyntaxErrorRunQueryResult
>

export const PythonErrorRunQueryResult = z.object({
  type: z.literal('python-error'),
  ename: z.string(),
  evalue: z.string(),
  traceback: z.array(z.string()),
})
export type PythonErrorRunQueryResult = z.infer<
  typeof PythonErrorRunQueryResult
>

export const RunQueryResult = z.union([
  SuccessRunQueryResult,
  SyntaxErrorRunQueryResult,
  AbortErrorRunQueryResult,
  PythonErrorRunQueryResult,
])
export type RunQueryResult = z.infer<typeof RunQueryResult>

export const jsonString = z.string().transform((str, ctx): Json => {
  try {
    return JSON.parse(str)
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON' })
    return z.NEVER
  }
})

export function parseOrElse<T>(
  schema: z.Schema<T>,
  value: unknown,
  defaultValue: T
): T {
  const result = schema.safeParse(value)
  if (result.success) {
    return result.data
  }

  return defaultValue
}

export function parseJSONOrElse<T>(
  schema: z.Schema<T>,
  value: string,
  defaultValue: T
): T {
  return parseOrElse(jsonString.pipe(schema), value, defaultValue)
}

// visualization related types
export const VisualizationStringFilterSingleValueOperator = z.union([
  z.literal('eq'),
  z.literal('ne'),
  z.literal('contains'),
  z.literal('notContains'),
  z.literal('startsWith'),
  z.literal('endsWith'),
  z.literal('isNull'),
  z.literal('isNotNull'),
])
export type VisualizationStringFilterSingleValueOperator = z.infer<
  typeof VisualizationStringFilterSingleValueOperator
>

export const VisualizationOperatorWithoutValue = z.union([
  z.literal('isNull'),
  z.literal('isNotNull'),
])
export type VisualizationOperatorWithoutValue = z.infer<
  typeof VisualizationOperatorWithoutValue
>

export const VisualizationStringFilterMultiValuesOperator = z.union([
  z.literal('in'),
  z.literal('notIn'),
])
export type VisualizationStringFilterMultiValuesOperator = z.infer<
  typeof VisualizationStringFilterMultiValuesOperator
>

export const VisualizationStringFilterOperator = z.union([
  VisualizationStringFilterSingleValueOperator,
  VisualizationStringFilterMultiValuesOperator,
])

export type VisualizationStringFilterOperator = z.infer<
  typeof VisualizationStringFilterOperator
>

export const VisualizationStringFilter = z.union([
  z.object({
    id: uuidSchema,
    column: DataFrameStringColumn,
    operator: VisualizationStringFilterOperator,
    value: z.string(),
    renderError: PythonErrorOutput.optional(),
    renderedValue: z.string().optional(),
  }),
  z.object({
    id: uuidSchema,
    column: DataFrameStringColumn,
    operator: VisualizationStringFilterMultiValuesOperator,
    value: z.array(z.string()),
    renderError: PythonErrorOutput.optional(),
    renderedValue: z.array(z.string()).optional(),
  }),
])
export type VisualizationStringFilter = z.infer<
  typeof VisualizationStringFilter
>
export const stringFilterOperators: VisualizationStringFilterOperator[] = [
  'eq',
  'ne',
  'in',
  'notIn',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'isNull',
  'isNotNull',
]

export const VisualizationNumberFilterOperator = z.union([
  z.literal('eq'),
  z.literal('ne'),
  z.literal('lt'),
  z.literal('lte'),
  z.literal('gt'),
  z.literal('gte'),
  z.literal('isNull'),
  z.literal('isNotNull'),
])
export type VisualizationNumberFilterOperator = z.infer<
  typeof VisualizationNumberFilterOperator
>

export const VisualizationNumberFilter = z.object({
  id: uuidSchema,
  column: DataFrameNumberColumn,
  operator: VisualizationNumberFilterOperator,
  value: z.union([z.string(), z.number()]),
  renderError: PythonErrorOutput.optional(),
  renderedValue: z.string().optional(),
})
export type VisualizationNumberFilter = z.infer<
  typeof VisualizationNumberFilter
>
export const numberFilterOperators: VisualizationNumberFilterOperator[] = [
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'isNull',
  'isNotNull',
]

export const VisualizationDateFilterOperator = z.union([
  z.literal('eq'),
  z.literal('ne'),
  z.literal('before'),
  z.literal('beforeOrEq'),
  z.literal('after'),
  z.literal('afterOrEq'),
  z.literal('isNull'),
  z.literal('isNotNull'),
])
export type VisualizationDateFilterOperator = z.infer<
  typeof VisualizationDateFilterOperator
>
export const dateFilterOperators: VisualizationDateFilterOperator[] = [
  'eq',
  'ne',
  'before',
  'beforeOrEq',
  'after',
  'afterOrEq',
  'isNull',
  'isNotNull',
]

export const VisualizationDateFilter = z.object({
  id: uuidSchema,
  column: DataFrameDateColumn,
  operator: VisualizationDateFilterOperator,
  value: z.union([dateSchema, z.string()]),
  renderError: PythonErrorOutput.optional(),
  renderedValue: z.string().optional(),
})
export type VisualizationDateFilter = z.infer<typeof VisualizationDateFilter>

const VisualizationFilterOperator = z.union([
  VisualizationNumberFilterOperator,
  VisualizationStringFilterOperator,
  VisualizationDateFilterOperator,
])

export const UnfinishedVisualizationFilter = z.object({
  id: uuidSchema,
  type: z.literal('unfinished-visualization-filter'),
  column: DataFrameColumn.nullable(),
  operator: VisualizationFilterOperator.nullable(),
  value: z.union([z.string(), z.number(), z.array(z.string())]).nullable(),
})
export type UnfinishedVisualizationFilter = z.infer<
  typeof UnfinishedVisualizationFilter
>

export const VisualizationFilter = z.union([
  VisualizationStringFilter,
  VisualizationNumberFilter,
  VisualizationDateFilter,
  UnfinishedVisualizationFilter,
])
export type VisualizationFilter = z.infer<typeof VisualizationFilter>

export type FinishedVisualizationFilter = Exclude<
  VisualizationFilter,
  UnfinishedVisualizationFilter
>

export const TimeUnit = z.union([
  z.literal('year'),
  z.literal('quarter'),
  z.literal('month'),
  z.literal('week'),
  z.literal('date'),
  z.literal('hours'),
  z.literal('minutes'),
  z.literal('seconds'),
])
export type TimeUnit = z.infer<typeof TimeUnit>

export const AggregateFunction = z.union([
  z.literal('sum'),
  z.literal('mean'),
  z.literal('median'),
  z.literal('count'),
  z.literal('min'),
  z.literal('max'),
  z.literal('count'),
])
export type AggregateFunction = z.infer<typeof AggregateFunction>

// Shared formatting types for both xAxis and SeriesV2
export type DateFormatStyle =
  | 'MMMM d, yyyy'
  | 'd MMMM, yyyy'
  | 'EEEE, MMMM d, yyyy'
  | 'M/d/yyyy'
  | 'd/M/yyyy'
  | 'yyyy/M/d'
  | null

export type TimeFormatStyle = 'h:mm a' | 'HH:mm' | null

export type DateFormat = {
  dateStyle: DateFormatStyle
  showTime: boolean
  timeFormat: TimeFormatStyle
}

export type NumberFormatStyle = 'normal' | 'percent' | 'scientific'

export type NumberSeparatorStyle =
  | '999,999.99'
  | '999.999,99'
  | '999 999,99'
  | '999999.99'

export type NumberFormat = {
  style: NumberFormatStyle
  separatorStyle: NumberSeparatorStyle
  decimalPlaces: number
  multiplier: number
  prefix: string | null
  suffix: string | null
}

// Combined date-time format type
export type DateTimeFormatString =
  | DateFormatStyle
  | TimeFormatStyle
  | `${NonNullable<DateFormatStyle>} ${NonNullable<TimeFormatStyle>}`
  | ''

export type Series = {
  chartType: ChartType | null
  column: DataFrameColumn | null
  aggregateFunction: AggregateFunction | null
  colorBy: DataFrameColumn | null
  axisName: string | null
}

export type SeriesV2 = {
  id: string
  chartType: ChartType | null
  column: DataFrameColumn | null
  aggregateFunction: AggregateFunction | null
  groupBy: DataFrameColumn | null
  name: string | null
  color: string | null
  groups:
    | {
        group: string
        name: string
        color: string
      }[]
    | null
  dateFormat: DateFormat | null
  numberFormat: NumberFormat | null
}

export type YAxis = {
  series: Series[]
}

export type YAxisV2 = {
  id: string
  name: string | null
  series: SeriesV2[]
}

export const HistogramFormat = z.union([
  z.literal('count'),
  z.literal('percentage'),
])
export type HistogramFormat = z.infer<typeof HistogramFormat>

export const HistogramBin = z.union([
  z.object({
    type: z.literal('auto'),
  }),
  z.object({
    type: z.literal('stepSize'),
    value: z.number(),
  }),
  z.object({
    type: z.literal('maxBins'),
    value: z.number(),
  }),
])
export type HistogramBin = z.infer<typeof HistogramBin>

export const ChartType = z.union([
  z.literal('groupedColumn'),
  z.literal('stackedColumn'),
  z.literal('hundredPercentStackedColumn'),
  z.literal('line'),
  z.literal('area'),
  z.literal('hundredPercentStackedArea'),
  z.literal('scatterPlot'),
  z.literal('pie'),
  z.literal('histogram'),
  z.literal('trend'),
  z.literal('number'),
])
export type ChartType = z.infer<typeof ChartType>

export const VisualizationError = z.union([
  z.literal('dataframe-not-found'),
  z.literal('unknown'),
])
export type VisualizationError = z.infer<typeof VisualizationError>

export function isUnfinishedVisualizationFilter(
  filter: VisualizationFilter
): filter is UnfinishedVisualizationFilter {
  return 'type' in filter && filter.type === 'unfinished-visualization-filter'
}

export const VisualizationBlockState = z.object({
  _v: z.literal(1),
  chartType: ChartType.default('groupedColumn'),
  dataframeId: z.string().nullable().default(null),
  isHidden: z.boolean().default(false),
  xAxis: z.string().nullable().default(null),
  xAxisGroupFunction: TimeUnit.nullable().default(null),
  xAxisSort: z
    .union([z.literal('ascending'), z.literal('descending')])
    .default('ascending'),
  yAxis: z.string().nullable().default(null),
  yAxisAggregateFunction: AggregateFunction.nullable().default(null),
  colorBy: z.string().nullable().default(null),
  error: VisualizationError.nullable().default(null),
  spec: z.record(Json).nullable().default(null),
  updatedAt: z.number().nullable().default(null),
  hideTooManyDataPointsWarning: z.boolean().default(false),
  filters: z.array(VisualizationFilter).default([]),
})
export type VisualizationBlockState = z.infer<typeof VisualizationBlockState>

export function emptyVisualizationBlockState(): VisualizationBlockState {
  return {
    _v: 1,
    chartType: 'groupedColumn',
    dataframeId: null,
    isHidden: false,
    xAxis: null,
    xAxisGroupFunction: null,
    xAxisSort: 'ascending',
    yAxis: null,
    yAxisAggregateFunction: null,
    colorBy: null,
    spec: null,
    error: null,
    updatedAt: null,
    hideTooManyDataPointsWarning: false,
    filters: [],
  }
}

export type InvalidReason =
  | {
      type: 'simple'
      reason: 'invalid-column' | 'empty-value' | 'invalid-value'
    }
  | {
      type: 'render'
      reason: PythonErrorOutput
    }

export function getInvalidReason(
  column: DataFrameColumn,
  value: string | string[]
): InvalidReason | null {
  if (NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(column.type).success) {
    if (value === '') {
      return { type: 'simple', reason: 'empty-value' as const }
    }

    if (Number.isNaN(Number(value))) {
      return { type: 'simple', reason: 'invalid-value' as const }
    }
    return null
  }

  if (NumpyStringTypes.or(NumpyJsonTypes).safeParse(column.type).success) {
    if ((Array.isArray(value) && value.length === 0) || value === '') {
      return { type: 'simple', reason: 'empty-value' as const }
    }

    return null
  }

  if (NumpyDateTypes.safeParse(column.type).success) {
    if (value === '') {
      return { type: 'simple', reason: 'empty-value' as const }
    }

    const date = toDate(value.toString())
    if (!date) {
      return { type: 'simple', reason: 'invalid-value' as const }
    }

    return null
  }

  return null
}

export function isInvalidVisualizationFilter(
  filter: VisualizationFilter,
  dataframe: DataFrame
): boolean {
  if (isUnfinishedVisualizationFilter(filter)) {
    return true
  }

  const column = dataframe.columns.find(
    (col) => col.name === filter.column.name
  )
  if (!column) {
    return true
  }

  if (
    VisualizationStringFilterMultiValuesOperator.safeParse(filter.operator)
      .success
  ) {
    return !Array.isArray(filter.value) || filter.value.length === 0
  }

  if (VisualizationOperatorWithoutValue.safeParse(filter.operator).success) {
    return false
  }

  return (
    filter.value === '' ||
    filter.renderError !== undefined ||
    (filter.renderedValue !== undefined &&
      getInvalidReason(column, filter.renderedValue) !== null)
  )
}

export const DataSourceColumn = z.object({
  name: z.string(),
  type: z.string(),
})
export type DataSourceColumn = z.infer<typeof DataSourceColumn>

export const DataSourceTable = z.object({
  columns: z.array(DataSourceColumn),
})
export type DataSourceTable = z.infer<typeof DataSourceTable>

export const DataSourceSchema = z.object({
  tables: z.record(DataSourceTable),
})
export type DataSourceSchema = z.infer<typeof DataSourceSchema>

export const DataSourceStructureError = z.union([
  PythonErrorOutput,
  z.object({ type: z.literal('unknown'), message: z.string() }),
])

export type DataSourceStructureError = z.infer<typeof DataSourceStructureError>

const SuccessDataSourceStructureStateV3 = z.object({
  id: uuidSchema,
  status: z.literal('success'),
  updatedAt: z.number(),
  refreshPing: z.number().nullable(),
  defaultSchema: z.string(),
  additionalContext: z.string().nullable(),
  version: z.literal(3),
})

const FailedDataSourceStructureStateV3 = z.object({
  id: uuidSchema,
  status: z.literal('failed'),
  failedAt: z.number(),
  previousSuccessAt: z.number().nullable(),
  error: DataSourceStructureError,
  defaultSchema: z.string().nullable(),
  additionalContext: z.string().nullable(),
  version: z.literal(3),
})

const LoadingDataSourceStructureStateV3 = z.object({
  id: uuidSchema,
  status: z.literal('loading'),
  startedAt: z.number(),
  loadingPing: z.number(),
  additionalContext: z.string().nullable(),
  version: z.literal(3),
})
export const DataSourceStructureStateV3 = z.union([
  SuccessDataSourceStructureStateV3,
  FailedDataSourceStructureStateV3,
  LoadingDataSourceStructureStateV3,
])

export type DataSourceStructureStateV3 = z.infer<
  typeof DataSourceStructureStateV3
>

export const DataSourceStructureState = DataSourceStructureStateV3

export type DataSourceStructureState = z.infer<typeof DataSourceStructureState>

export function isDataSourceStructureLoading(
  state: DataSourceStructureStateV3
): boolean {
  switch (state.status) {
    case 'loading':
      return true
    case 'success':
      return state.refreshPing !== null
    case 'failed':
      return false
  }
}

export const PythonSuggestion = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
  type: z.string(),
  signature: z.string(),
})

export type PythonSuggestion = z.infer<typeof PythonSuggestion>

export type PythonSuggestionsResult =
  | {
      status: 'success'
      suggestions: PythonSuggestion[]
    }
  | {
      status: 'invalid-payload'
    }
  | {
      status: 'unexpected-error'
    }

export const DataSourceConnectionError = z.object({
  name: z.string(),
  message: z.string(),
})

export type DataSourceConnectionError = z.infer<
  typeof DataSourceConnectionError
>

export const BrieferFile = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  relCwdPath: z.string().min(1),
  size: z.number().int().nonnegative(),
  mimeType: z.string().nullish(),
  createdAt: z.number().nonnegative(),
  isDirectory: z.boolean(),
})

export type BrieferFile = z.infer<typeof BrieferFile>

export const WriteBackSuccessResult = z.object({
  _tag: z.literal('success'),
  dataSourceId: z.string(),
  tableName: z.string(),
  overwritten: z.boolean(),
  insertedRows: z.number(),
  updatedRows: z.number(),
  ignoredRows: z.number(),
  executedAt: z.string(),
})
export type WriteBackSuccessResult = z.infer<typeof WriteBackSuccessResult>

export const WriteBackErrorResult = z.union([
  z.object({
    _tag: z.literal('error'),
    step: z.literal('validation'),
    reason: z.union([
      z.literal('dataframe-not-found'),
      z.literal('datasource-not-found'),
    ]),
    executedAt: z.string(),
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.literal('validation'),
    reason: z.literal('invalid-table-template'),
    executedAt: z.string(),
    pythonError: PythonErrorOutput,
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.union([
      z.literal('validation'),
      z.literal('schema-inspection'),
      z.literal('cleanup'),
      z.literal('insert'),
      z.literal('unknown'),
    ]),
    executedAt: z.string(),
    reason: z.literal('python-error'),
    ename: z.string(),
    evalue: z.string(),
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.literal('validation'),
    reason: z.literal('invalid-table-name'),
    executedAt: z.string(),
    message: z.string(),
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.literal('validation'),
    reason: z.literal('invalid-conflict-columns'),
    executedAt: z.string(),
    columns: z.array(z.string()),
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.literal('schema-inspection'),
    reason: z.undefined(),
    message: z.string(),
    executedAt: z.string(),
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.literal('cleanup'),
    reason: z.undefined(),
    message: z.string(),
    executedAt: z.string(),
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.literal('insert'),
    reason: z.undefined(),
    message: z.string(),
    executedAt: z.string(),
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.literal('unknown'),
    reason: z.undefined(),
    executedAt: z.string(),
  }),
  z.object({
    _tag: z.literal('error'),
    step: z.undefined().optional(),
    reason: z.literal('overwrite-empty-dataframe'),
    executedAt: z.string(),
  }),
])
export type WriteBackErrorResult = z.infer<typeof WriteBackErrorResult>

export const WriteBackResult = z.union([
  WriteBackSuccessResult,
  WriteBackErrorResult,
])
export type WriteBackResult = z.infer<typeof WriteBackResult>

export type Properties = {
  needsSetup: boolean
  disableCustomOpenAiKey: boolean
  disabledAnonymousTelemetry: boolean
}

export function getDomain(email: string): string {
  const parts = email.split('@').slice(1)
  return parts.join('')
}

export const PivotTableResult = z.object({
  page: z.number(),
  pageSize: z.number(),
  pageCount: z.number(),
  data: z.object({
    index: z.array(z.union([Json, z.array(Json)])),
    columns: z.array(z.array(Json)),
    data: z.array(z.array(Json)),
  }),
  pivotRows: z.array(z.string()),
  pivotColumns: z.array(z.string()),
  pivotMetrics: z.array(z.string()),
})

export type PivotTableResult = z.infer<typeof PivotTableResult>

export type PivotTableSort =
  | {
      _tag: 'column'
      metric: string
      order: 'asc' | 'desc'
      columnValues: Json[]
    }
  | {
      _tag: 'row'
      row: string
      order: 'asc' | 'desc'
    }

const workspaceEditBase = z.object({
  name: z.string().optional(),
  assistantModel: z.string().optional(),
  openAiApiKey: z.string().optional(),
})

export const WorkspaceEditFormValues = z.union([
  workspaceEditBase.extend({ name: z.string() }),
  workspaceEditBase.extend({ assistantModel: z.string() }),
  workspaceEditBase.extend({ openAiApiKey: z.string() }),
])

export type WorkspaceEditFormValues = z.infer<typeof WorkspaceEditFormValues>

export const WorkspaceCreateValues = z.object({
  name: z.string(),
  useContext: z
    .union([z.literal('work'), z.literal('personal'), z.literal('studies')])
    .optional(),
  useCases: z.array(z.string()).optional(),
  source: z.string().optional(),
  inviteEmails: z.array(z.string()).optional(),
})

export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateValues>

export type Comment = {
  user: {
    name: string
    picture: string | null
  }
  id: string
  content: string
  documentId: string
  userId: string
  createdAt: string
  updatedAt: string
}

export type SQLQueryConfiguration = {
  version: 1
  athena?: {
    resultReuseConfiguration: {
      resultReuseByAgeConfiguration: {
        enabled: boolean
        maxAgeInMinutes: number
      }
    }
  }
}

export function exhaustiveCheck(_param: never) {}

export enum ElementType {
  Block = 'BLOCK',
  BlockGroup = 'BLOCK_GROUP',
}

export const OnboardingTutorialStep = z.enum([
  'connectDataSource',
  'runQuery',
  'runPython',
  'createVisualization',
  'publishDashboard',
  'inviteTeamMembers',
])
export type OnboardingTutorialStep = z.infer<typeof OnboardingTutorialStep>

export const TutorialStepStatus = z.enum(['current', 'completed', 'upcoming'])
export type TutorialStepStatus = z.infer<typeof TutorialStepStatus>

export type StepStates = Record<OnboardingTutorialStep, TutorialStepStatus>

export type TutorialState = {
  id: string
  isCompleted: boolean
  isDismissed: boolean
  stepStates: StepStates
}

export type FeatureFlags = {
  visualizationsV2: boolean
}

export const TableSort = z.object({
  order: z.union([z.literal('asc'), z.literal('desc')]),
  column: z.string(),
})

export type TableSort = z.infer<typeof TableSort>
