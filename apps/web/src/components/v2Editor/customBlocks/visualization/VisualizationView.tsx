import { fontFamily as twFontFamiliy } from 'tailwindcss/defaultTheme'
import { timeFormat } from 'd3-time-format'
import { format as d3Format } from 'd3-format'
import {
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
} from '@heroicons/react/24/solid'
import { Vega, VisualizationSpec } from 'react-vega'
import {
  ArrowLongDownIcon,
  ArrowLongUpIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { CubeTransparentIcon } from '@heroicons/react/24/solid'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { ChartType, DataFrame } from '@briefer/types'
import LargeSpinner from '@/components/LargeSpinner'
import clsx from 'clsx'
import useSideBar from '@/hooks/useSideBar'
import useResettableState from '@/hooks/useResettableState'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import debounce from 'lodash.debounce'
import { findMaxFontSize, measureText } from '@/measureText'

const FONT_FAMILY = ['Inter', ...twFontFamiliy.sans].join(', ')

interface Props {
  title: string
  chartType: ChartType
  spec: VisualizationSpec | null
  tooManyDataPointsHidden: boolean
  onHideTooManyDataPointsWarning: () => void
  loading: boolean
  error: 'dataframe-not-found' | 'unknown' | 'invalid-params' | null
  dataframe: DataFrame | null
  onNewSQL: () => void
  controlsHidden: boolean
  isFullscreen: boolean
  renderer?: 'canvas' | 'svg'
  isHidden: boolean
  onToggleHidden: () => void
  onExportToPNG?: () => void
  isDashboard: boolean
  isEditable: boolean
}
function VisualizationView(props: Props) {
  const [isSideBarOpen] = useSideBar()
  const key = `${isSideBarOpen}${props.controlsHidden.toString()}${props.isFullscreen.toString()}`

  return (
    <div
      // we use key to force re-render when controlsHidden changes
      key={key}
      className={clsx(
        !props.controlsHidden && !props.isDashboard && 'w-2/3',
        'flex-grow h-full flex items-center justify-center relative'
      )}
    >
      {props.spec ? (
        <div className="relative w-full h-full">
          <BrieferVega
            title={props.title}
            spec={props.spec}
            renderer={props.renderer}
            chartType={props.chartType}
            isDashboard={props.isDashboard}
          />
          {props.loading && (
            <div className="absolute top-0 left-0 h-full w-full flex flex-col items-center justify-center bg-ceramic-50/60 ">
              <LargeSpinner color="#b8f229" />
            </div>
          )}
          {!props.tooManyDataPointsHidden && !props.isDashboard && (
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
      {!props.isDashboard && props.isEditable && (
        <button
          className={clsx(
            'absolute bottom-0 bg-white rounded-tr-md border-t border-r border-gray-200 p-1 hover:bg-gray-50 z-10',
            props.isHidden ? 'left-0 rounded-bl-md' : '-left-[1px]'
          )}
          onClick={props.onToggleHidden}
        >
          {props.isHidden ? (
            <ChevronDoubleRightIcon className="h-3 w-3 text-gray-400" />
          ) : (
            <ChevronDoubleLeftIcon className="h-3 w-3 text-gray-400" />
          )}
        </button>
      )}
      {props.isHidden && !props.isDashboard && (
        <button
          className="absolute bottom-0 bg-white rounded-tl-md rounded-br-md border-t border-l border-gray-200 p-1 hover:bg-gray-50 z-10 right-0 text-xs"
          onClick={props.onExportToPNG}
        >
          PNG
        </button>
      )}
    </div>
  )
}

function BrieferVega(props: {
  title: string
  chartType: ChartType
  isDashboard: boolean
  spec: VisualizationSpec
  renderer?: 'canvas' | 'svg'
}) {
  const [size, setSize] = useResettableState(
    null as { width: number; height: number } | null,
    [props.spec, props.renderer]
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

  const spec: VisualizationSpec = useMemo(() => {
    if (!size) {
      return props.spec
    }

    let config = props.spec.config

    // @ts-ignore
    let layer = props.spec.layer

    if (size.width < 300) {
      try {
        config = {
          ...(props.spec.config ?? {}),
          // @ts-ignore
          axis: {
            ...(props.spec.config?.axis ?? {}),
            labels: false,
          },
        }

        // @ts-ignore
        layer = props.spec.layer?.map((layer) => ({
          ...layer,
          layer: layer.layer?.map((l: any) =>
            l.encoding?.color
              ? {
                  ...l,
                  encoding: {
                    ...l.encoding,
                    color: { ...l.encoding.color, legend: null },
                  },
                }
              : l
          ),
        }))
      } catch (err) {
        console.error(err)
      }
    }

    return {
      ...props.spec,
      width: size.width,
      height: size.height,
      config,
      layer,
    } as VisualizationSpec
  }, [props.spec, size])

  if (!size) {
    return <div className="w-full h-full" ref={measureDiv} />
  }

  if (props.chartType === 'trend' || props.chartType === 'number') {
    return (
      <div ref={container} className="ph-no-capture h-full">
        <BigNumberVisualization
          chartType={props.chartType}
          title={props.title}
          spec={spec}
          size={size}
          isDashboard={props.isDashboard}
        />
      </div>
    )
  }

  return (
    <div ref={container} className="ph-no-capture h-full">
      <Vega
        className="rounded-b-md overflow-hidden"
        spec={spec}
        renderer={props.renderer ?? 'canvas'}
        actions={false}
      />
    </div>
  )
}

function extractXYFromSpec(spec: any) {
  let layer = spec.layer[0]
  while ('layer' in layer) {
    layer = layer.layer[0]
  }

  const { x, y } = layer.encoding
  return { x, y }
}

function BigNumberVisualization(props: {
  title: string
  chartType: 'trend' | 'number'
  spec: any
  size: { width: number; height: number }
  isDashboard: boolean
}) {
  const { spec, size } = props

  try {
    // @ts-ignore
    const dataset = spec.datasets[spec.data.name]
    // @ts-ignore
    const { x, y } = extractXYFromSpec(spec)
    const latests = dataset.slice(-2)
    const latest = latests.pop()
    const prev = latests.pop()

    const lastValue = {
      x: latest[x.field],
      displayX: latest[x.field],
      y: latest[y.field],
      displayY: latest[y.field],
    }
    const prevValue = {
      x: prev?.[x.field] ?? 0,
      displayX: prev?.[x.field] ?? 0,
      y: prev?.[y.field],
      displayY: prev?.[y.field] ?? 0,
    }
    const yFormat = y.axis.format
    if (yFormat) {
      lastValue.displayY = d3Format(yFormat)(lastValue.y)
      prevValue.displayY = d3Format(yFormat)(prevValue.y)
    }

    const xFormat = x.axis.format
    if (xFormat) {
      lastValue.displayX = d3Format(xFormat)(lastValue.x)
      prevValue.displayX = d3Format(xFormat)(prevValue.x)
    } else {
      const xType = x.type
      switch (xType) {
        case 'temporal': {
          const timeUnit = x.timeUnit

          if (!timeUnit) {
            lastValue.displayX = new Date(lastValue.x).toLocaleDateString()
            prevValue.displayX = new Date(prevValue.x).toLocaleDateString()
          } else {
            const timeFormats: Record<string, string> = {
              year: '%b %d, %Y %I:00 %p',
              yearmonth: '%b %d, %Y %I:00 %p',
              yearquarter: '%b %d, %Y %I:00 %p',
              yearweek: '%b %d, %Y %I:00 %p',
              yearmonthdate: '%b %d, %Y %I:00 %p',
              yearmonthdatehours: '%b %d, %Y %I:00 %p',
              yearmonthdatehoursminutes: '%b %d, %Y %I:%M %p',
              yearmonthdatehoursminutesseconds: '%b %d, %Y %I:%M:%S %p',
            }
            const format = timeFormats[timeUnit]
            if (format) {
              const formatter = timeFormat(format)
              lastValue.displayX = formatter(new Date(lastValue.x))
              prevValue.displayX = formatter(new Date(prevValue.x))
            }
          }
          break
        }
        case 'quantitative':
          lastValue.displayX = d3Format('.2f')(lastValue.x)
          prevValue.displayX = d3Format('.2f')(prevValue.x)
          break
        case 'ordinal':
          lastValue.displayX = lastValue.x
          prevValue.displayX = prevValue.x
          break
      }
    }

    const minDimension = Math.min(size.width, size.height)
    const fontSize = Math.min(
      Math.max(
        8,
        Math.min(
          findMaxFontSize(
            lastValue.displayY,
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
                  {trend === 0 ? null : trend < 0 ? (
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

export default VisualizationView
