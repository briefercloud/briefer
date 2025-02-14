import * as echarts from 'echarts-unofficial-v6'
import { fontFamily as twFontFamiliy } from 'tailwindcss/defaultTheme'
import { format as d3Format } from 'd3-format'
import {
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
} from '@heroicons/react/24/solid'
import {
  ArrowLongDownIcon,
  ArrowLongUpIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { CubeTransparentIcon } from '@heroicons/react/24/solid'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { DataFrame } from '@briefer/types'
import LargeSpinner from '@/components/LargeSpinner'
import clsx from 'clsx'
import useSideBar from '@/hooks/useSideBar'
import useResettableState from '@/hooks/useResettableState'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import debounce from 'lodash.debounce'
import { findMaxFontSize, measureText } from '@/measureText'
import {
  VisualizationV2BlockInput,
  VisualizationV2BlockOutputResult,
} from '@briefer/editor'
import { head } from 'ramda'

const FONT_FAMILY = ['Inter', ...twFontFamiliy.sans].join(', ')

interface Props {
  title: string
  input: VisualizationV2BlockInput
  result: VisualizationV2BlockOutputResult | null
  tooManyDataPointsHidden: boolean
  onHideTooManyDataPointsWarning: () => void
  loading: boolean
  error:
    | 'dataframe-not-found'
    | 'dataframe-not-set'
    | 'unknown'
    | 'invalid-params'
    | null
  dataframe: DataFrame | null
  onNewSQL: () => void
  controlsHidden: boolean
  isFullScreen: boolean
  renderer?: 'canvas' | 'svg'
  isHidden: boolean
  onToggleHidden: () => void
  onExportToPNG?: () => void
  hasControls: boolean
  isEditable: boolean
}
function VisualizationViewV2(props: Props) {
  const [isSideBarOpen] = useSideBar()
  const key = `${isSideBarOpen}${props.controlsHidden.toString()}${props.isFullScreen.toString()}`

  return (
    <div
      // we use key to force re-render when controlsHidden changes
      key={key}
      className={clsx(
        !props.controlsHidden && props.hasControls && 'w-2/3',
        'flex-grow h-full flex items-center justify-center relative'
      )}
    >
      {props.result ? (
        <div className="relative w-full h-full">
          <BrieferResult
            title={props.title}
            result={props.result}
            renderer={props.renderer}
            input={props.input}
            hasControls={props.hasControls}
          />
          {props.loading && (
            <div className="absolute top-0 left-0 h-full w-full flex flex-col items-center justify-center bg-ceramic-50/60 ">
              <LargeSpinner color="#b8f229" />
            </div>
          )}
          {!props.tooManyDataPointsHidden && !props.hasControls && (
            <div className="absolute top-0 left-0 right-0 bg-yellow-50 p-2">
              <div className="flex items-center justify-center gap-x-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                <span className="text-xs leading-5 text-yellow-700">
                  Too many data points. Consider filtering or aggregating the
                  data.{' '}
                </span>
                <button
                  className="absolute right-2.5"
                  onClick={props.onHideTooManyDataPointsWarning}
                >
                  <XMarkIcon className="h-4 w-4 text-gray-300 hover:text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : props.loading ? (
        <div className="absolute top-0 left-0 h-full w-full flex flex-col items-center justify-center bg-ceramic-50/60 ">
          <LargeSpinner color="#b8f229" />
        </div>
      ) : (
        <div className="flex flex-col h-full w-full space-y-6 items-center justify-center bg-ceramic-50/30">
          {props.error === 'dataframe-not-found' && props.dataframe ? (
            <div className="flex flex-col items-center justify-center gap-y-2">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-300" />
              <div className="flex flex-col items-center text-sm text-gray-300 gap-y-2">
                <div>
                  <span className="font-mono">{props.dataframe.name}</span> not
                  found.
                </div>
                <div>
                  Try running the block for{' '}
                  <span className="font-mono">{props.dataframe.name}</span>{' '}
                  again.
                </div>
              </div>
            </div>
          ) : props.error === 'unknown' ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-300" />
              <span className="text-lg text-gray-300">
                Something went wrong
              </span>
            </div>
          ) : props.error === 'invalid-params' ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-300" />
              <span className="text-lg text-gray-300">
                Missing or invalid parameters
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <CubeTransparentIcon className="h-12 w-12 text-gray-300" />
              <span className="text-lg text-gray-300">No data</span>
              {!props.dataframe && (
                <button
                  className="text-xs text-gray-300 hover:underline"
                  onClick={props.onNewSQL}
                >
                  Add a SQL block to fetch data to visualize.
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {props.hasControls && props.isEditable && (
        <button
          className={clsx(
            'absolute bottom-0 bg-white rounded-tr-md border-t border-r border-gray-200 p-2 hover:bg-gray-50 z-10',
            props.isHidden ? 'left-0 rounded-bl-md' : '-left-[1px]'
          )}
          onClick={props.onToggleHidden}
        >
          {props.isHidden ? (
            <ChevronDoubleRightIcon className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDoubleLeftIcon className="h-4 w-4 text-gray-400" />
          )}
        </button>
      )}
      {props.hasControls &&
        props.input.chartType !== 'number' &&
        props.input.chartType !== 'trend' && (
          <button
            className="absolute bottom-0 bg-white rounded-tl-md rounded-br-md border-t border-l border-gray-200 p-2 hover:bg-gray-50 z-10 right-0 text-xs text-gray-400"
            onClick={props.onExportToPNG}
          >
            PNG
          </button>
        )}
    </div>
  )
}

function BrieferResult(props: {
  title: string
  input: VisualizationV2BlockInput
  hasControls: boolean
  result: VisualizationV2BlockOutputResult
  renderer?: 'canvas' | 'svg'
}) {
  const [size, setSize] = useResettableState(
    () => null as { width: number; height: number } | null,
    [props.result, props.renderer]
  )

  const measureDiv = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!size && measureDiv.current) {
      const { width, height } = measureDiv.current.getBoundingClientRect()
      setSize({ width, height })
    }
  }, [measureDiv.current, size])

  useEffect(() => {
    if (!container.current) {
      return
    }

    const parent = container.current.parentElement
    if (!parent) {
      return
    }

    const observer = new ResizeObserver(
      debounce(() => {
        const { width, height } = parent.getBoundingClientRect()

        // we must compare whether the values distance surpasses 1 pixel to prevent
        // infinite loops due to mismatching floating points
        const widthDiff = Math.abs((size?.width ?? 0) - width)
        const heightDiff = Math.abs((size?.height ?? 0) - height)
        if (size && widthDiff < 1 && heightDiff < 1) {
          return
        }

        setSize((size) => {
          if (
            width &&
            height &&
            (!size || size.width !== width || size.height !== height)
          ) {
            return null
          }

          return size
        })
      }, 500)
    )

    observer.observe(parent)

    return () => {
      observer.disconnect()
    }
  }, [container.current])

  // @ts-ignore
  const option: echarts.EChartsOption = useMemo(() => {
    const grid: echarts.EChartsOption['grid'] = {
      ...props.result.grid,
      left: props.hasControls ? '36px' : '28px',
      right: props.hasControls ? '36' : '28px',
      bottom: props.hasControls ? '56' : '28px',
    }

    if (props.hasControls) {
      grid['top'] = '92px'
    }

    return {
      ...props.result,
      legend: {
        ...props.result.legend,
        padding: props.hasControls
          ? [28, 28, 0, 28]
          : [props.title ? 4 : 20, 28, 0, 8],
        type: 'scroll',
        icon: 'circle',
        textStyle: {
          padding: [0, 0, 0, -6],
          fontWeight: 'bold',
          color: '#6b7280',
        },
        left: !props.hasControls ? 18 : 'center',
      },
      grid,
      xAxis: props.result.xAxis.map((axis) => ({
        ...axis,
        axisLabel: {
          hideOverlap: true,
        },
        splitLine: {
          show: false,
        },
      })),
      yAxis: props.result.yAxis.map((axis) => ({
        ...axis,
      })),
      tooltip: {
        ...props.result.tooltip,
        valueFormatter: (value) => {
          if (typeof value === 'number') {
            return Math.round(value * 100) / 100
          }
          return value
        },
      },
    }
  }, [props.result, size])

  if (!size) {
    return <div className="w-full h-full" ref={measureDiv} />
  }

  if (props.input.chartType === 'trend' || props.input.chartType === 'number') {
    return (
      <div ref={container} className="ph-no-capture h-full">
        <BigNumberVisualization
          title={props.title}
          chartType={props.input.chartType}
          input={props.input}
          result={props.result}
          size={size}
        />
      </div>
    )
  }

  return (
    <div ref={container} className="ph-no-capture h-full">
      <Echarts
        width={size.width}
        height={size.height}
        option={option}
        renderer={props.renderer}
      />
    </div>
  )
}

interface EchartsProps {
  width: number
  height: number
  option: echarts.EChartsOption
  renderer?: 'canvas' | 'svg'
}
function Echarts(props: EchartsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [chart, setChart] = useState<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) {
      return
    }

    const chart = echarts.init(ref.current, { renderer: props.renderer })
    setChart(chart)

    return () => {
      chart.dispose()
    }
  }, [ref.current, props.renderer])

  useEffect(() => {
    if (chart) {
      chart.setOption(props.option)
    }
  }, [props.option, chart])

  return <div ref={ref} className="w-full h-full" />
}

function BigNumberVisualization(props: {
  title: string
  input: VisualizationV2BlockInput
  chartType: 'number' | 'trend'
  result: VisualizationV2BlockOutputResult
  size: { width: number; height: number }
}) {
  const { size } = props

  try {
    const y = head(head(props.input.yAxes)?.series ?? [])?.id
    if (!y) {
      throw new Error('Invalid input')
    }

    const x = props.input.xAxis?.name?.toString() ?? y

    let latests = head(props.result.dataset)?.source.slice(-2)
    const latest = latests?.pop()
    const prev = latests?.pop()

    if (!latest) {
      throw new Error('Invalid result')
    }

    let displayY = latest[y].toString()
    if (typeof latest[y] === 'number') {
      displayY = (Math.round(latest[y] * 100) / 100).toString()
    }

    const lastValue = {
      x: latest[x],
      displayX: latest[x].toString(),
      y: Number(latest[y]),
      displayY,
    }

    let prevDisplayY = 'N/A'
    if (prev) {
      prevDisplayY = prev[y].toString()
      if (typeof prev[y] === 'number') {
        prevDisplayY = (Math.round(prev[y] * 100) / 100).toString()
      }
    }
    const prevValue = {
      x: prev?.[x]?.toString(),
      displayX: (prev?.[x] ?? 'N/A').toString(),
      y: prev?.[y] ? Number(prev[y]) : Number.NaN,
      displayY: prevDisplayY,
    }

    const minDimension = Math.min(size.width, size.height)
    const fontSize = Math.min(
      Math.max(
        8,
        Math.min(
          findMaxFontSize(
            lastValue.displayY.toString(),
            minDimension / 3,
            size.width - 32,
            'bold',
            FONT_FAMILY
          ),
          100
        )
      )
    )

    const lastXValueFontSize = Math.max(fontSize / 4, 12)
    const prevYValueFontSize = Math.max(lastXValueFontSize * 0.9, 10)

    let trend = lastValue.y === prevValue.y ? 0 : lastValue.y / prevValue.y - 1
    if (prevValue.y !== lastValue.y) {
      if (prevValue.y === 0) {
        trend = Infinity
      } else if (lastValue.y === 0) {
        trend = -1
      }
    }

    let trendDisplay = d3Format('.2%')(Math.abs(trend))
    if (trend === 0) {
      trendDisplay = 'No change'
    } else if (Number.isNaN(trend)) {
      trendDisplay = 'N/A'
    } else if (trend === Infinity) {
      trendDisplay = '∞%'
    }

    const lastXValueFits = minDimension > 200

    const trendWidth =
      measureText(`↑ ${trendDisplay}`, prevYValueFontSize, '500', FONT_FAMILY)
        .width +
      // four for padding
      4

    const prevXValueWidth = measureText(
      `• vs. ${prevValue.displayX}`,
      prevYValueFontSize,
      '500',
      FONT_FAMILY
    ).width

    const prevYValueWidth = measureText(
      `: ${prevValue.displayY}`,
      (fontSize / 4) * 0.9,
      '500',
      FONT_FAMILY
    ).width

    const prevYValueFits =
      size.width - 32 > prevYValueWidth + prevXValueWidth + trendWidth

    const prevXValueFits = size.width - 32 > prevXValueWidth + trendWidth

    const arrowSize =
      !prevXValueFits && !lastXValueFits
        ? Math.min(prevYValueFontSize * 1.8, size.height - fontSize * 1.3 - 32)
        : prevYValueFontSize

    return (
      <div className="flex flex-col h-full py-2 px-4">
        <div className="flex flex-col justify-center items-center text-center h-full overflow-hidden">
          <h1
            className="font-bold text-neutral-800"
            style={{ fontSize, lineHeight: `${fontSize + 6}px` }}
          >
            {lastValue.displayY}
          </h1>
          {props.chartType === 'trend' && (
            <>
              {lastXValueFits && (
                <h3
                  className="text-neutral-600 font-medium"
                  style={{ fontSize: lastXValueFontSize }}
                >
                  {lastValue.displayX}
                </h3>
              )}
              <div
                className="flex justify-center font-medium text-nowrap"
                style={{ fontSize: prevYValueFontSize }}
              >
                <div
                  className={clsx(
                    {
                      'text-red-500': trend < 0,
                      'text-green-500': trend > 0,
                      'text-sky-500': trend === 0,
                    },
                    'flex items-center'
                  )}
                  style={{
                    fontSize:
                      !prevXValueFits && !lastXValueFits
                        ? Math.min(
                            prevYValueFontSize * 1.8,
                            size.height - fontSize * 1.3 - 32
                          )
                        : prevYValueFontSize,
                  }}
                >
                  {trend === 0 || Number.isNaN(trend) ? null : trend < 0 ? (
                    <ArrowLongDownIcon
                      style={{ height: arrowSize, width: arrowSize }}
                    />
                  ) : (
                    <ArrowLongUpIcon
                      style={{ height: arrowSize, width: arrowSize }}
                    />
                  )}
                  <span>{trendDisplay}</span>
                </div>
                {prevXValueFits && (
                  <>
                    <span className="text-neutral-400 px-1">•</span>
                    <h4 className="text-neutral-500">
                      vs. {prevValue.displayX}
                      {prevYValueFits && (
                        <>
                          :
                          <span className="text-neutral-400">
                            {' '}
                            {prevValue.displayY}
                          </span>
                        </>
                      )}
                    </h4>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  } catch (err) {
    console.error(err)
    return null
  }
}

export default VisualizationViewV2
