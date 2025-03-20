import DragList from '@/components/DragList'
import { useOnClickOutside2 } from '@/hooks/useOnClickOutside'
import useResizeMemo from '@/hooks/useResizeMemo'
import { Serie, VisualizationV2BlockOutputResult } from '@briefer/editor'
import { DataFrame, SeriesV2, YAxisV2 } from '@briefer/types'
import { Transition } from '@headlessui/react'
import clsx from 'clsx'
import { GripVerticalIcon } from 'lucide-react'
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
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
  '#879bd7',
  '#b2db9e',
  '#fbd88a',
  '#f39494',
  '#9dd3e8',
  '#ffffff',
  '#000000',
]

interface Props {
  yAxes: YAxisV2[]
  dataframe: DataFrame | null
  isEditable: boolean
  result: VisualizationV2BlockOutputResult | null
  onChangeSeries: (id: SeriesV2['id'], series: SeriesV2) => void
  onChangeAllSeries: (yIndex: number, series: SeriesV2[]) => void
}

function DisplayControls(props: Props) {
  return (
    <div className="text-xs text-gray-500 flex flex-col space-y-8">
      {props.yAxes.map((yAxis, yI) => {
        let prefix = ''
        if (props.yAxes.length > 1) {
          prefix = yI === 0 ? 'Left ' : 'Right '
        }

        const items = yAxis.series.map((s) => {
          const output = props.result?.series.find((rs) => rs.id === s.id)
          return {
            ...s,
            color:
              s.color ?? (output ? getColorFromSerie(output) : null) ?? null,
          }
        })

        return (
          <div key={yI}>
            <div className="text-sm font-medium leading-6 text-gray-900 pb-2">
              {prefix} Y-Axis
            </div>
            <div className="flex flex-col space-y-4">
              <DragList
                items={items}
                onChange={(items) => props.onChangeAllSeries(yI, items)}
                getKey={(s) => s.id}
                kind={`y-axis-${yI}-series`}
              >
                {({ item, drag, dragPreview, drop, isDragging, ref }) => {
                  return (
                    <DisplayYAxisSeries
                      ref={ref}
                      drag={drag}
                      dragPreview={dragPreview}
                      drop={drop}
                      isDragging={isDragging}
                      series={item}
                      dataframe={props.dataframe}
                      isEditable={props.isEditable}
                      yIndex={yI}
                      result={props.result}
                      onChangeSeries={props.onChangeSeries}
                    />
                  )
                }}
              </DragList>
            </div>
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
  drag: ConnectDragSource
  drop: ConnectDropTarget
  dragPreview: ConnectDragPreview
  isDragging: boolean
  series: SeriesV2
  dataframe: DataFrame | null
  isEditable: boolean
  yIndex: number
  result: VisualizationV2BlockOutputResult | null
  onChangeSeries: (id: SeriesV2['id'], series: SeriesV2) => void
}
const DisplayYAxisSeries = forwardRef<HTMLDivElement, DisplayYAxisSeriesProps>(
  function DisplayYAxisSeries(props, ref) {
    const groups = useMemo(
      () =>
        uniqBy(
          (g) => g.group,
          (props.series.groups ?? []).concat(
            props.result?.series
              .filter(
                (s) =>
                  s.id !== props.series.id && s.id.includes(props.series.id)
              )
              .map((s) => {
                const group = s.id.split(':').slice(1).join(':')
                return {
                  group,
                  name: s.name?.toString() ?? group,
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
      <div
        className="rounded-md border border-gray-200 shadow-sm px-2 py-3.5 bg-gray-50"
        ref={(d) => {
          props.dragPreview(props.drop(d))
        }}
      >
        <div
          ref={ref}
          className={clsx(props.isDragging ? 'opacity-30' : 'opacity-100')}
        >
          <div className="flex items-center">
            <div
              className="text-gray-400/60 hover:text-gray-400 cursor-grab"
              ref={(el) => {
                props.drag(el)
              }}
            >
              <GripVerticalIcon />
            </div>
            <div className="w-full relative">
              <input
                type="text"
                placeholder={props.series.column?.name?.toString() ?? ''}
                className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-blue-300 group pr-2.5 pl-10 text-gray-800 text-xs placeholder:text-gray-400 relative bg-white disabled:cursor-not-allowed disabled:bg-gray-50"
                disabled={
                  !props.dataframe ||
                  !props.isEditable ||
                  props.series.groupBy !== null
                }
                value={props.series.name ?? ''}
                onChange={onChangeSerieName}
                onBlur={onBlur}
              />
              <div className="absolute left-2 top-1/2 leading-[0px] transform -translate-y-1/2 cursor-pointer">
                <ColorPicker
                  className=""
                  color={color}
                  onChangeColor={onChangeColor}
                />
              </div>
            </div>
          </div>
          {props.series.groupBy && !props.isDragging && (
            <>
              <div className="text-xs text-gray-900 pl-2 pt-4 pb-2 flex items-center justify-between">
                <span className="font-medium">Group by</span>{' '}
              </div>
              <div className="flex flex-col space-y-1.5">
                <DragList
                  items={groups}
                  onChange={onChangeGroups}
                  getKey={(g) => g.group}
                  kind={`series-${props.series.id}-groups`}
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
              </div>
            </>
          )}
        </div>
      </div>
    )
  }
)

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
      className={clsx(props.isDragging ? 'opacity-50' : 'opacity-100')}
      ref={(d) => {
        props.drop(d)
      }}
    >
      <div className="flex items-center space-x-1 pl-1" ref={ref}>
        <div
          className="text-gray-400/60 hover:text-gray-400 cursor-pointer"
          ref={(el) => {
            props.drag(el)
          }}
        >
          <GripVerticalIcon />
        </div>
        <div
          className="relative w-full group"
          ref={(el) => {
            props.dragPreview(el)
          }}
        >
          <input
            type="text"
            placeholder={props.group}
            className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-blue-300 bg-white pr-2.5 pl-10 text-gray-800 text-xs placeholder:text-gray-400 relative"
            disabled={!props.dataframe || !props.isEditable}
            value={props.name}
            onChange={onChangeName}
            onBlur={onBlur}
          />
          <div className="absolute left-2 top-1/2 leading-[0px] transform -translate-y-1/2">
            <ColorPicker color={props.color} onChangeColor={onChangeColor} />
          </div>
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
        className="w-5 h-5 rounded-full border hover:opacity-90 transition-opacity duration-300"
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
