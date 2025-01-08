import * as echarts from 'echarts'
import {
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
} from '@heroicons/react/24/solid'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { CubeTransparentIcon } from '@heroicons/react/24/solid'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { ChartType, DataFrame } from '@briefer/types'
import LargeSpinner from '@/components/LargeSpinner'
import clsx from 'clsx'
import useSideBar from '@/hooks/useSideBar'
import useResettableState from '@/hooks/useResettableState'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import debounce from 'lodash.debounce'
import { VisualizationV2BlockOutput } from '@briefer/editor'

interface Props {
  title: string
  chartType: ChartType
  output: VisualizationV2BlockOutput | null
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
  isFullscreen: boolean
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
      {props.output ? (
        <div className="relative w-full h-full">
          <Visualization
            title={props.title}
            output={props.output}
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
      {!props.isDashboard &&
        props.chartType !== 'number' &&
        props.chartType !== 'trend' && (
          <button
            className="absolute bottom-0 bg-white rounded-tl-md rounded-br-md border-t border-l border-gray-200 p-1 hover:bg-gray-50 z-10 right-0 text-xs text-gray-400"
            onClick={props.onExportToPNG}
          >
            PNG
          </button>
        )}
    </div>
  )
}

function Visualization(props: {
  title: string
  chartType: ChartType
  isDashboard: boolean
  output: VisualizationV2BlockOutput
}) {
  const [size, setSize] = useResettableState(
    () => null as { width: number; height: number } | null,
    [props.output]
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

  if (!size) {
    return <div className="w-full h-full" ref={measureDiv} />
  }

  if (props.chartType === 'trend' || props.chartType === 'number') {
    // TODO
    return null
    // return (
    //   <div ref={container} className="ph-no-capture h-full">
    //     <BigNumberVisualization
    //       chartType={props.chartType}
    //       title={props.title}
    //       spec={spec}
    //       size={size}
    //       isDashboard={props.isDashboard}
    //     />
    //   </div>
    // )
  }

  return (
    <div ref={container} className="ph-no-capture h-full">
      <Echarts
        width={size.width}
        height={size.height}
        option={props.output.result}
      />
    </div>
  )
}

function BigNumberVisualization(props: {
  title: string
  chartType: 'trend' | 'number'
  size: { width: number; height: number }
  isDashboard: boolean
}) {
  return null
}

interface EchartsProps {
  width: number
  height: number
  option: echarts.EChartsOption
}
function Echarts(props: EchartsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [chart, setChart] = useState<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) {
      return
    }

    const chart = echarts.init(ref.current)
    setChart(chart)

    return () => {
      chart.dispose()
    }
  }, [ref.current])

  useEffect(() => {
    if (chart) {
      chart.setOption(props.option)
    }
  }, [props.option, chart])

  return <div ref={ref} className="w-full h-full" />
}

export default VisualizationView
