import Ansi from '@cocalc/ansi-to-react'
import clsx from 'clsx'
import Plot from 'react-plotly.js'
import {
  Output,
  PythonErrorOutput,
  PythonHTMLOutput,
  PythonPlotlyOutput,
} from '@briefer/types'
import PythonError from './PythonError'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import createDomPurify, { DOMPurifyI } from 'dompurify'
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import useResettableState from '@/hooks/useResettableState'
import { downloadFile } from '@/utils/file'
import debounce from 'lodash.debounce'
import { PythonBlock } from '@briefer/editor'

interface Props {
  className?: string
  outputs: Output[]
  isFixWithAILoading: boolean
  canFixWithAI: boolean
  onFixWithAI: (error: PythonErrorOutput) => void
  isPDF: boolean
  isDashboardView: boolean
  lazyRender: boolean
  blockId: string
}

let domPurify: DOMPurifyI

function getDomPurify() {
  if (domPurify) {
    return domPurify
  }

  domPurify = createDomPurify(window)
  return domPurify
}

const EXPENSIVE_TYPES = new Set<PythonBlock['result'][0]['type']>([
  'plotly',
  'html',
])

export function PythonOutputs(props: Props) {
  const [rendered, setRendered] = useResettableState(
    () => Math.min(props.lazyRender ? 1 : props.outputs.length),
    [props.outputs, props.lazyRender]
  )

  useEffect(() => {
    if (!props.lazyRender || rendered === props.outputs.length) {
      return
    }

    const cb = () => {
      setRendered((prev) => {
        // render outputs until the next expensive type
        const nextExpensiveTypeIndex = props.outputs.findIndex(
          (output, i) => i > prev && EXPENSIVE_TYPES.has(output.type)
        )

        return nextExpensiveTypeIndex !== -1
          ? nextExpensiveTypeIndex
          : props.outputs.length
      })
    }

    const anim = requestAnimationFrame(cb)

    return () => {
      cancelAnimationFrame(anim)
    }
  }, [props.outputs, rendered, props.lazyRender])

  return (
    <div className={props.className}>
      {props.outputs.slice(0, rendered).map((output, i) => (
        <div
          key={i}
          className={clsx(
            ['plotly'].includes(output.type) ? 'flex-grow' : '',
            'bg-white overflow-x-scroll'
          )}
        >
          <PythonOutput
            output={output}
            isFixWithAILoading={props.isFixWithAILoading}
            onFixWithAI={props.onFixWithAI}
            isPDF={props.isPDF}
            canFixWithAI={props.canFixWithAI}
            isDashboardView={props.isDashboardView}
            blockId={props.blockId}
          />
        </div>
      ))}
    </div>
  )
}

interface ItemProps {
  output: Output
  isFixWithAILoading: boolean
  onFixWithAI: (error: PythonErrorOutput) => void
  isPDF: boolean
  isDashboardView: boolean
  canFixWithAI: boolean
  blockId: string
}
export function PythonOutput(props: ItemProps) {
  const onExportToPNG = () => {
    if (props.output.type !== 'image' || props.output.format !== 'png') return

    downloadFile(
      `data:image/${props.output.format};base64, ${props.output.data}`,
      props.blockId
    )
  }

  switch (props.output.type) {
    case 'image':
      switch (props.output.format) {
        case 'png':
          return (
            <>
              <img
                className="printable-block"
                alt="generated image"
                src={`data:image/${props.output.format};base64, ${props.output.data}`}
              />
              {!props.isDashboardView && (
                <div className="w-full flex flex-col items-end">
                  <button
                    className="bg-white rounded-md rounded-br-md border border-gray-200 p-1 hover:bg-gray-50 z-10 text-xs text-gray-400"
                    onClick={onExportToPNG}
                  >
                    PNG
                  </button>
                </div>
              )}
            </>
          )
      }
    case 'stdio':
      return (
        <pre
          className={clsx(
            props.output.name === 'stderr' ? 'text-red-500' : '',
            'text-sm'
          )}
        >
          <Ansi>{props.output.text}</Ansi>
        </pre>
      )
    case 'plotly': {
      return (
        <PythonPlotOutput
          output={props.output}
          isPDF={props.isPDF}
          isDashboardView={props.isDashboardView}
        />
      )
    }
    case 'html': {
      return <HTMLOutput output={props.output} />
    }
    case 'error':
      return (
        <PythonError
          canFixWithAI={props.canFixWithAI}
          error={props.output}
          isFixWithAILoading={props.isFixWithAILoading}
          onFixWithAI={props.onFixWithAI}
        />
      )
  }
}

type PythonOutputWrapperProps = {
  outputs: React.JSX.Element[]
  isCollapsed: boolean
  collapseToggle: () => void
}

export function PythonOutputWrapper(props: PythonOutputWrapperProps) {
  return (
    <div className="pt-3.5 ph-no-capture printable-block">
      <div className="px-3 text-xs text-gray-300 pb-3.5 flex items-center gap-x-0.5">
        <button
          className="h-4 w-4 hover:text-gray-400"
          onClick={props.collapseToggle}
        >
          {props.isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        </button>
        <span>{props.isCollapsed ? 'Output collapsed' : 'Output'}</span>
      </div>
      <div className={clsx(props.isCollapsed ? 'hidden' : '', 'px-8 pb-6')}>
        {props.outputs}
      </div>
    </div>
  )
}

function HTMLOutput(props: { output: PythonHTMLOutput }) {
  const clean = useMemo(
    () =>
      getDomPurify().sanitize(props.output.html, {
        ALLOWED_TAGS: [
          'table',
          'caption',
          'tr',
          'th',
          'td',
          'thead',
          'tbody',
          'tfoot',
          'colgroup',
          'col',
        ],
      }),
    [props.output.html]
  )

  return (
    <div
      className="python-html-output printable-block"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

const MAX_PIE_LABELS = 1000

function PythonPlotOutput(props: {
  output: PythonPlotlyOutput
  isPDF: boolean
  isDashboardView: boolean
}) {
  const layout = useMemo(() => {
    return {
      ...props.output.layout,
      autosize: true,
    }
  }, [props.output.layout])

  const hideControls = useMemo(() => {
    return props.isPDF || props.isDashboardView
  }, [props.isPDF, props.isDashboardView])

  const config = useMemo(() => {
    if (hideControls) {
      return {
        displaylogo: false,
        displayModeBar: false,
      }
    }

    return {
      displaylogo: false,
    }
  }, [hideControls])

  const data = useMemo(() => {
    return props.output.data.map((d: any) => ({
      ...d,
      labels: d.type === 'pie' ? d.labels?.slice(0, MAX_PIE_LABELS) : d.labels,
    }))
  }, [props.output.data])

  if (props.isDashboardView) {
    return <DashboardPlotOutput output={props.output} />
  }

  return (
    <Plot
      data={data}
      layout={layout}
      config={config}
      useResizeHandler={true}
      className="w-full printable-block"
    />
  )
}

function DashboardPlotOutput(props: { output: PythonPlotlyOutput }) {
  const [size, setSize] = useResettableState(
    () => null as { width: number; height: number } | null,
    [props.output.layout]
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
        setSize(null)
      }, 500)
    )

    observer.observe(parent)

    return () => {
      observer.disconnect()
    }
  }, [container])

  const config = useMemo(
    () => ({
      displaylogo: false,
      displayModeBar: false,
      responsive: true,
    }),
    []
  )

  const layout = useMemo(() => {
    const defaultWidth = 700
    const givenWidth = props.output.layout.width ?? defaultWidth
    const actualWidth = size?.width ?? givenWidth

    const defaultHeight = 450
    const givenHeight = props.output.layout.height ?? defaultHeight
    const actualHeight = (size?.height ?? givenHeight) - 6

    const wScale = actualWidth / givenWidth
    const hScale = actualHeight / givenHeight

    // https://plotly.com/python/reference/layout/#layout-font-size
    const defaultFontSize = 12

    return {
      ...props.output.layout,
      autosize: true,
      width: actualWidth,
      height: actualHeight,
      font: props.output.layout.font ?? {
        size: defaultFontSize * Math.min(wScale, hScale, 1),
      },
    }
  }, [props.output.layout, size])

  if (!size) {
    return <div className="w-full h-full" ref={measureDiv} />
  }

  return (
    <div ref={container}>
      <Plot
        data={props.output.data}
        layout={layout}
        config={config}
        useResizeHandler={true}
      />
    </div>
  )
}
