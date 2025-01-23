import DragList from '@/components/DragList'
import { useOnClickOutside2 } from '@/hooks/useOnClickOutside'
import useResizeMemo from '@/hooks/useResizeMemo'
import { Serie, VisualizationV2BlockOutputResult } from '@briefer/editor'
import { DataFrame, SeriesV2, YAxisV2 } from '@briefer/types'
import { Transition } from '@headlessui/react'
import clsx from 'clsx'
import { uniqBy } from 'ramda'
import {
  CSSProperties,
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { SketchPicker } from 'react-color'
import {
  ConnectDragPreview,
  ConnectDragSource,
  ConnectDropTarget,
} from 'react-dnd'
import ReactDOM from 'react-dom'

const presetColors = [
  '#516b91',
  '#59c4e6',
  '#edafda',
  '#93b7e3',
  '#a5e7f0',
  '#cbb0e3',
  '#2a9d8f',
  '#e76f51',
  '#f4a261',
  '#264653',
  '#e9c46a',
  '#ff6f61',
  '#6a4c93',
  '#ffa600',
  '#ffffff',
  '#000000',
]

interface Props {
  yAxes: YAxisV2[]
  dataframe: DataFrame | null
  isEditable: boolean
  result: VisualizationV2BlockOutputResult | null
  onChangeSeries: (id: SeriesV2['id'], series: SeriesV2) => void
}

function DisplayControls(props: Props) {
  return (
    <div className="text-xs text-gray-500 flex flex-col space-y-8">
      {props.yAxes.map((yAxis, yI) => {
        let prefix = ''
        if (props.yAxes.length > 1) {
          prefix = yI === 0 ? 'Left ' : 'Right '
        }

        return (
          <div key={yI}>
            <div className="text-md font-medium leading-6 text-gray-900 pb-2">
              {prefix} Y-Axis
            </div>
            {yAxis.series.map((s) => (
              <DisplayYAxisSeries
                key={s.id}
                series={s}
                dataframe={props.dataframe}
                isEditable={props.isEditable}
                yIndex={yI}
                result={props.result}
                onChangeSeries={props.onChangeSeries}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function getColorFromSerie(s: Serie): string | null {
  switch (s.type) {
    case 'bar':
      return s.color ?? null
    case 'line':
      return s.lineStyle?.color ?? null
    case 'scatter':
      return s.itemStyle?.color ?? null
  }
}

interface DisplayYAxisSeriesProps {
  series: SeriesV2
  dataframe: DataFrame | null
  isEditable: boolean
  yIndex: number
  result: VisualizationV2BlockOutputResult | null
  onChangeSeries: (id: SeriesV2['id'], series: SeriesV2) => void
}
function DisplayYAxisSeries(props: DisplayYAxisSeriesProps) {
  const groups = useMemo(
    () =>
      uniqBy(
        (g) => g.group,
        (props.series.groups ?? []).concat(
          props.result?.series
            .filter(
              (s) => s.id !== props.series.id && s.id.includes(props.series.id)
            )
            .map((s) => {
              const group = s.id.split(':').slice(1).join(':')
              return {
                group,
                name: s.name ?? group,
                color: getColorFromSerie(s) ?? presetColors[0],
              }
            }) ?? []
        )
      ),
    [props.series.groups, props.result?.series, props.series.id]
  )

  const onChangeGroups = useCallback(
    (groups: SeriesV2['groups']) => {
      props.onChangeSeries(props.series.id, { ...props.series, groups })
    },
    [props.series.id, props.onChangeSeries]
  )

  const columnsSeries = props.result?.series.find(
    (s) => s.id === props.series.id
  )
  const color =
    props.series.color ??
    (columnsSeries ? getColorFromSerie(columnsSeries) : null) ??
    presetColors[0]
  const onChangeColor = useCallback(
    (color: string) => {
      props.onChangeSeries(props.series.id, { ...props.series, color })
    },
    [props.series.id, props.onChangeSeries]
  )

  const onChangeSerieName = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      props.onChangeSeries(props.series.id, {
        ...props.series,
        name: e.target.value,
      })
    },
    [props.series.id, props.onChangeSeries]
  )

  const onBlur = useCallback(() => {
    if (props.series.name?.trim() === '') {
      props.onChangeSeries(props.series.id, {
        ...props.series,
        name: props.series.column?.name?.toString() ?? '',
      })
    }
  }, [props.series, props.onChangeSeries])

  const onChangeGroupName = useCallback(
    (group: string, name: string) => {
      const newItems = groups.map((item) =>
        item.group === group ? { ...item, name } : item
      )
      onChangeGroups(newItems)
    },
    [groups, onChangeGroups]
  )

  const onChangeGroupColor = useCallback(
    (group: string, color: string) => {
      const newItems = groups.map((item) =>
        item.group === group ? { ...item, color } : item
      )
      onChangeGroups(newItems)
    },
    [groups, onChangeGroups]
  )

  if (!props.series.column) {
    return null
  }

  return (
    <div className="pt-1.5">
      <label
        className="block text-xs leading-6 text-gray-900 pb-1 flex items-center justify-between"
        htmlFor={`series-name-${props.series.id}`}
      >
        <span className="font-medium">Column</span>{' '}
        <span className="font-mono bg-gray-100 text-gray-400 text-xs px-1 py-0.5 rounded-md flex items-center justify-center text-[10px]">
          {props.series.column.name.toString()}
        </span>
      </label>

      <div className="flex items-center space-x-1">
        <div className="w-full relative">
          <input
            name={`series-name-${props.series.id}`}
            type="text"
            placeholder={props.series.column?.name?.toString() ?? ''}
            className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group pr-2.5 pl-10 text-gray-800 text-xs placeholder:text-gray-400 relative"
            disabled={!props.dataframe || !props.isEditable}
            value={props.series.name ?? ''}
            onChange={onChangeSerieName}
            onBlur={onBlur}
          />
          <ColorPicker
            className="absolute left-1 top-1"
            color={color}
            onChangeColor={onChangeColor}
          />
        </div>
      </div>
      {props.series.groupBy && (
        <>
          <div className="text-xs leading-6 text-gray-900 pt-1.5 flex items-center justify-between">
            <span className="font-medium">Group By</span>{' '}
            <span className="font-mono bg-gray-100 text-gray-400 text-xs px-1 py-0.5 rounded-md flex items-center justify-center text-[10px]">
              {props.series.groupBy.name.toString()}
            </span>
          </div>
          <DragList
            items={groups}
            onChange={onChangeGroups}
            getKey={(g) => g.group}
          >
            {({ item, drag, dragPreview, drop, isDragging, ref }) => (
              <GroupBySeriesDisplay
                ref={ref}
                drag={drag}
                dragPreview={dragPreview}
                drop={drop}
                isDragging={isDragging}
                group={item.group}
                name={item.name}
                onChangeName={onChangeGroupName}
                color={item.color}
                onChangeColor={onChangeGroupColor}
                dataframe={props.dataframe}
                isEditable={props.isEditable}
              />
            )}
          </DragList>
        </>
      )}
    </div>
  )
}

interface GroupBySeriesDisplayProps {
  drag: ConnectDragSource
  drop: ConnectDropTarget
  dragPreview: ConnectDragPreview
  isDragging: boolean
  group: string
  name: string
  onChangeName: (group: string, name: string) => void
  color: string
  onChangeColor: (group: string, color: string) => void
  dataframe: DataFrame | null
  isEditable: boolean
}
const GroupBySeriesDisplay = forwardRef<
  HTMLDivElement,
  GroupBySeriesDisplayProps
>(function GroupBySeriesDisplay(props, ref) {
  const onChangeColor = useCallback(
    (color: string) => {
      props.onChangeColor(props.group, color)
    },
    [props.onChangeColor, props.group]
  )

  const onChangeName = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      props.onChangeName(props.group, e.target.value)
    },
    [props.onChangeName, props.group]
  )

  const onBlur = useCallback(() => {
    if (props.name.trim() === '') {
      props.onChangeName(props.group, props.group)
    }
  }, [props.group, props.name, props.onChangeName])

  return (
    <div
      ref={(d) => {
        props.drop(d)
      }}
    >
      <div className="flex items-center space-x-1" ref={ref}>
        <div
          className={clsx(
            'h-5 w-5 text-gray-400/60 group-hover/wrapper:opacity-100  transition-opacity duration-200 ease-in-out flex items-center justify-center cursor-pointer',
            props.isDragging ? 'opacity-0' : 'opacity-1'
          )}
          ref={(el) => {
            props.drag(el)
          }}
        >
          <svg
            height="24"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="m0 0h24v24h-24z" fill="none" />
            <path
              fill="currentColor"
              d="m11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
            />
          </svg>
        </div>
        <div
          className="relative w-full"
          ref={(el) => {
            props.dragPreview(el)
          }}
        >
          <input
            type="text"
            placeholder={props.group}
            className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group pr-2.5 pl-10 text-gray-800 text-xs placeholder:text-gray-400 relative"
            disabled={!props.dataframe || !props.isEditable}
            value={props.name}
            onChange={onChangeName}
            onBlur={onBlur}
          />
          <ColorPicker
            className="absolute left-1 top-1"
            color={props.color}
            onChangeColor={onChangeColor}
          />
        </div>
      </div>
    </div>
  )
})

interface ColorPickerProps {
  color: string
  className?: string
  onChangeColor: (color: string) => void
}
function ColorPicker(props: ColorPickerProps) {
  const onChangeColor = useCallback(
    (color: { hex: string }) => {
      props.onChangeColor(color.hex)
    },
    [props.onChangeColor]
  )

  const [pickerOpen, setPickerOpen] = useState(false)
  const onTogglePickerOpen = useCallback(() => {
    setPickerOpen((prev) => !prev)
  }, [])

  const buttonRef = useRef<HTMLButtonElement>(null)

  const dropdownStyle: CSSProperties = useResizeMemo(
    (rect) => ({
      position: 'absolute',
      top: rect?.bottom,
      left: rect?.left ?? 0,
      zIndex: 9001,
    }),
    buttonRef.current
  )

  const pickerContainerRef = useRef<HTMLDivElement>(null)
  useOnClickOutside2(
    () => {
      setPickerOpen(false)
    },
    pickerContainerRef,
    buttonRef,
    pickerOpen
  )
  return (
    <div className={props.className}>
      <button
        className="w-6 h-6 rounded-md border hover:opacity-90 transition-opacity duration-300"
        style={{ backgroundColor: props.color }}
        onClick={onTogglePickerOpen}
        ref={buttonRef}
      />
      {ReactDOM.createPortal(
        <Transition
          className="pt-2"
          show={pickerOpen}
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          style={dropdownStyle}
          as="div"
          ref={pickerContainerRef}
        >
          <SketchPicker
            color={props.color}
            onChange={onChangeColor}
            presetColors={presetColors}
          />
        </Transition>,
        document.body
      )}
    </div>
  )
}

export default DisplayControls
