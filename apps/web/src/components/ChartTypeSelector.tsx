import ReactDOM from 'react-dom'
import { useCallback, useEffect, useRef } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { ChartType } from '@briefer/types'
import useDropdownPosition from '@/hooks/dropdownPosition'

type Chart = {
  value: ChartType
  label: string
  icon: string
  comingSoon?: boolean
}
const charts: Chart[] = [
  {
    value: 'groupedColumn',
    label: 'Grouped column',
    icon: 'grouped-column.svg',
  },
  {
    value: 'stackedColumn',
    label: 'Stacked column',
    icon: 'stacked-column.svg',
  },
  {
    value: 'hundredPercentStackedColumn',
    label: '100%-stacked column',
    icon: '100-stacked-column.svg',
  },
  {
    value: 'line',
    label: 'Line',
    icon: 'line.svg',
  },
  {
    value: 'area',
    label: 'Area',
    icon: 'area.svg',
  },
  {
    value: 'hundredPercentStackedArea',
    label: '100%-stacked area',
    icon: '100-stacked-area.svg',
  },
  {
    value: 'scatterPlot',
    label: 'Scatter Plot',
    icon: 'scatter.svg',
  },
  {
    value: 'histogram',
    label: 'Histogram',
    icon: 'histogram.svg',
  },
  {
    value: 'trend',
    label: 'Trend',
    icon: 'trend.svg',
  },
  {
    value: 'number',
    label: 'Number',
    icon: 'number.svg',
  },
]

interface Props {
  label: string
  value: ChartType
  onChange: (type: ChartType) => void
  isEditable: boolean
  compact?: boolean
}

export default function ChartTypeSelector(props: Props) {
  const selected = charts.find((type) => type.value === props.value)
  useEffect(() => {
    if (!selected) {
      props.onChange(charts[0].value)
    }
  }, [selected])

  const buttonRef = useRef<HTMLButtonElement>(null)
  const { onOpen, dropdownPosition } = useDropdownPosition(buttonRef)

  const onClickButton = useCallback(() => {
    if (props.isEditable) {
      onOpen()
    }
  }, [props.isEditable, onOpen])

  if (!selected) {
    return null
  }

  return (
    <Listbox
      value={props.value}
      onChange={props.onChange}
      disabled={!props.isEditable}
    >
      {({ open }) => (
        <>
          <div className="relative">
            {!props.compact && (
              <div className="block text-xs font-medium leading-6 text-gray-900 pb-1">
                {props.label}
              </div>
            )}
            <Listbox.Button
              className="text-xs w-full"
              ref={buttonRef}
              onClick={onClickButton}
            >
              <div className="border border-gray-200 rounded-md w-full px-3 flex items-center justify-between gap-x-2 w-full min-h-8">
                <div className="flex items-center justify-left gap-x-2 text-left w-full h-6">
                  <div className="h-4 w-6 rounded-sm grayscale">
                    <img src={`/images/charts/${selected.icon}`} alt="" />
                  </div>
                  {!props.compact && <span>{selected.label}</span>}
                </div>
                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
              </div>
            </Listbox.Button>
            {ReactDOM.createPortal(
              <Transition
                show={open}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                style={{
                  position: 'absolute',
                  top: dropdownPosition.top,
                  right: dropdownPosition.right,
                }}
                className="z-[2000] translate-x-1/2"
              >
                <Listbox.Options
                  as="div"
                  className="w-[30rem] z-20 mt-2 divide-y divide-gray-200 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none px-5 py-4"
                >
                  <div className="grid grid-cols-3 gap-x-4 gap-y-6 items-stretch">
                    {charts.map((option) => (
                      <Listbox.Option
                        as="div"
                        key={option.value}
                        disabled={option.comingSoon}
                        className={({ active }) =>
                          clsx(
                            active ? 'border-gray-600' : 'border-gray-200',
                            option.comingSoon
                              ? 'cursor-not-allowed'
                              : 'cursor-pointer',
                            'pb-3.5 pt-2.5 select-none rounded-md border flex flex-col justify-center items-center relative'
                          )
                        }
                        value={option.value}
                      >
                        {({ active }) => (
                          <>
                            <div className="h-12 w-20 rounded-sm">
                              <img
                                rel="preload"
                                src={`/images/charts/${option.icon}`}
                                alt=""
                                className={
                                  option.comingSoon
                                    ? 'grayscale opacity-50'
                                    : ''
                                }
                              />
                            </div>
                            <span
                              className={clsx(
                                active ? 'text-gray-600' : 'text-gray-400',
                                'text-center px-1.5 text-[10px] absolute bottom-0 translate-y-1/2 bg-white'
                              )}
                            >
                              {option.label}
                            </span>

                            {option.comingSoon && (
                              <div className="absolute h-3/4 w-5/6 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-2 py-1 flex items-center justify-center">
                                <div className="absolute h-full w-full top-0 left-0 bg-gray-100 opacity-80 rounded-md" />
                                <div className="relative text-xs text-gray-500 whitespace-nowrap">
                                  Coming soon
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </div>
                </Listbox.Options>
              </Transition>,
              document.body
            )}
          </div>
        </>
      )}
    </Listbox>
  )
}
