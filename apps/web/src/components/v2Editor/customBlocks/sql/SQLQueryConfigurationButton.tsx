import ReactDOM from 'react-dom'
import { APIDataSource } from '@briefer/database'
import { Switch, Transition } from '@headlessui/react'
import { Cog6ToothIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { DatabaseZapIcon } from 'lucide-react'
import { SQLQueryConfiguration } from '@briefer/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import useDropdownPosition from '@/hooks/dropdownPosition'

interface Props {
  value: SQLQueryConfiguration | null
  onChange: (value: SQLQueryConfiguration) => void
  dataSource: APIDataSource
  disabled: boolean
}
function SQLQueryConfigurationButton(props: Props) {
  if (props.dataSource.config.type !== 'athena') {
    return null
  }

  const onToggleResultReuseByAgeConfiguration = useCallback(
    (checked: boolean) => {
      props.onChange({
        ...(props.value ?? { version: 1 }),
        athena: {
          ...(props.value?.athena ?? {}),
          resultReuseConfiguration: {
            ...(props.value?.athena?.resultReuseConfiguration ?? {}),
            resultReuseByAgeConfiguration: {
              enabled: checked,
              maxAgeInMinutes:
                props.value?.athena?.resultReuseConfiguration
                  .resultReuseByAgeConfiguration.maxAgeInMinutes ?? 60,
            },
          },
        },
      })
    },
    [props.onChange, props.value]
  )

  const buttonRef = useRef<HTMLButtonElement>(null)
  const { onOpen, dropdownPosition } = useDropdownPosition(buttonRef)
  const [open, setOpen] = useState(false)
  const onToggleSettings = useCallback(() => {
    setOpen((prev) => !prev)
    onOpen()
  }, [])

  const popoverRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const [
    athenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes,
    setAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes,
  ] = useState(
    (
      props.value?.athena?.resultReuseConfiguration
        .resultReuseByAgeConfiguration.maxAgeInMinutes ?? 60
    ).toString()
  )
  const onChangeAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes =
    useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes(
        e.target.value
      )
    }, [])
  const onBlurAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes =
    useCallback(() => {
      const asNumber = parseInt(
        athenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes
      )
      if (Number.isNaN(asNumber)) {
        setAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes(
          '60'
        )
        return
      }

      if (asNumber < 1) {
        setAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes(
          '1'
        )
      } else if (asNumber > 1440) {
        setAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes(
          '1440'
        )
      }
    }, [
      athenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes,
    ])
  const athenaResultReuseConfigurationResultReuseByAgeConfigurationEnabled =
    props.value?.athena?.resultReuseConfiguration.resultReuseByAgeConfiguration
      .enabled ?? false
  useEffect(() => {
    const asNumber = parseInt(
      athenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes
    )
    const previousValue =
      props.value?.athena?.resultReuseConfiguration
        .resultReuseByAgeConfiguration.maxAgeInMinutes ?? 60

    if (previousValue === asNumber) {
      return
    }

    if (!Number.isNaN(asNumber)) {
      props.onChange({
        ...(props.value ?? { version: 1 }),
        athena: {
          ...(props.value?.athena ?? {}),
          resultReuseConfiguration: {
            ...(props.value?.athena?.resultReuseConfiguration ?? {}),
            resultReuseByAgeConfiguration: {
              enabled:
                athenaResultReuseConfigurationResultReuseByAgeConfigurationEnabled,
              maxAgeInMinutes: asNumber,
            },
          },
        },
      })
    }
  }, [
    athenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes,
    props.onChange,
    props.value,
    athenaResultReuseConfigurationResultReuseByAgeConfigurationEnabled,
  ])

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          className="rounded-sm h-6 min-w-6 flex items-center justify-center border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300"
          disabled={props.disabled}
          onClick={onToggleSettings}
        >
          <Cog6ToothIcon className="w-3 h-3" />
        </button>
        {ReactDOM.createPortal(
          <Transition
            as="div"
            show={open}
            className="z-[2000]"
            enter="transition-opacity duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            style={{
              position: 'absolute',
              top: dropdownPosition.top - 24,
              right: dropdownPosition.right + 28,
            }}
          >
            <div
              ref={popoverRef}
              className="w-72 bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none font-sans rounded-md"
            >
              <div className="px-4 py-3">
                <Switch.Group
                  as="div"
                  className="flex items-center justify-between space-x-2 pb-3"
                >
                  <Switch.Label
                    as="span"
                    className="text-sm leading-6 text-gray-900 flex items-center gap-x-2"
                    passive
                  >
                    <DatabaseZapIcon strokeWidth={2} className="w-4 h-4" />
                    Reuse query results
                  </Switch.Label>

                  <Switch
                    checked={
                      athenaResultReuseConfigurationResultReuseByAgeConfigurationEnabled
                    }
                    onChange={onToggleResultReuseByAgeConfiguration}
                    className={clsx(
                      athenaResultReuseConfigurationResultReuseByAgeConfigurationEnabled
                        ? 'bg-primary-500'
                        : 'bg-gray-200',
                      'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        athenaResultReuseConfigurationResultReuseByAgeConfigurationEnabled
                          ? 'translate-x-4'
                          : 'translate-x-0',
                        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                </Switch.Group>
                <div>
                  <label
                    htmlFor="athenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes"
                    className="block text-xs font-medium leading-6 text-gray-900 pb-1"
                  >
                    Maximum age (minutes)
                  </label>
                  <input
                    name="athenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes"
                    type="number"
                    placeholder="60"
                    className={clsx(
                      athenaResultReuseConfigurationResultReuseByAgeConfigurationEnabled
                        ? 'bg-white'
                        : 'bg-gray-100 cursor-not-allowed',
                      'w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 px-2.5 text-gray-800 text-xs placeholder:text-gray-400'
                    )}
                    value={
                      athenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes
                    }
                    onChange={
                      onChangeAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes
                    }
                    disabled={
                      !athenaResultReuseConfigurationResultReuseByAgeConfigurationEnabled
                    }
                    onBlur={
                      onBlurAthenaResultReuseConfigurationResultReuseByAgeConfigurationMaxAgeInMinutes
                    }
                    min="1"
                    max="1440"
                  />
                </div>
              </div>
            </div>
          </Transition>,
          document.body
        )}
      </div>
    </>
  )
}

export default SQLQueryConfigurationButton
