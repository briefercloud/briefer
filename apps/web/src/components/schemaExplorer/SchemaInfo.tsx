import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { APIDataSource, DataSource } from '@briefer/database'
import Spin from '../Spin'
import { DataSourceStructureError } from '@briefer/types'
import { useCallback, useMemo, useState } from 'react'
import { dataSourcePrettyName } from '../DataSourcesList'
import ScrollBar from '../ScrollBar'

interface SchemaInfoProps {
  dataSource: APIDataSource
  onRetrySchema: (dataSource: DataSource) => void
}
export function SchemaInfo(props: SchemaInfoProps): JSX.Element | null {
  switch (props.dataSource.structure.status) {
    case 'failed':
      return (
        <SchemaError
          config={props.dataSource.config}
          error={props.dataSource.structure.error}
          onRetry={props.onRetrySchema}
        />
      )
    case 'success':
      if (props.dataSource.structure.refreshPing !== null) {
        return <SchemaInfoLoading refreshing />
      }

      return null
    case 'loading':
      return <SchemaInfoLoading />
  }
}

function SchemaInfoLoading({ refreshing = false }: { refreshing?: boolean }) {
  return (
    <div className="font-normal w-full flex justify-center py-2 items-center gap-x-2 text-xs border-b border-gray-200 bg-white animate-pulse">
      <Spin />
      <span>{refreshing ? 'Refreshing' : 'Loading'} schema...</span>
    </div>
  )
}

interface SchemaErrorProps {
  error: DataSourceStructureError
  config: DataSource
  onRetry: (dataSource: DataSource) => void
}
function SchemaError(props: SchemaErrorProps) {
  const [open, setOpen] = useState(false)
  const onOpen = useCallback(() => {
    setOpen(true)
  }, [])

  const onClose = useCallback(() => {
    setOpen(false)
  }, [])

  const onRetry = useCallback(() => {
    onClose()
    props.onRetry(props.config)
  }, [onClose, props.onRetry, props.config])

  const error: JSX.Element = useMemo(() => {
    switch (props.error.type) {
      case 'error':
        return (
          <div>
            <ScrollBar className="px-4 py-4 bg-gray-100 w-full rounded-md overflow-auto max-h-56">
              <pre className="whitespace-pre-wrap">
                {props.error.ename} - {props.error.evalue}
              </pre>
            </ScrollBar>
          </div>
        )
      case 'unknown':
        return (
          <div>
            <ScrollBar className="px-4 py-4 bg-gray-100 w-full rounded-md overflow-auto max-h-56">
              <pre className="whitespace-pre-wrap">
                Unknown - {props.error.message}
              </pre>
            </ScrollBar>
          </div>
        )
    }
  }, [props.error])

  return (
    <>
      <button
        className="font-normal w-full flex justify-center py-2 items-center gap-x-1.5 text-sm bg-yellow-50 text-yellow-800 border-b border-yellow-600/20 hover:bg-yellow-100"
        onClick={onOpen}
      >
        <ExclamationTriangleIcon className="h-3 w-3 text-yellow-600" />
        <span>Briefer failed to refresh the schema.</span>
      </button>

      <Transition show={open}>
        <Dialog onClose={onClose} className="relative z-[100]">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon
                        aria-hidden="true"
                        className="h-6 w-6 text-red-600"
                      />
                    </div>
                    <div className="w-full mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left overflow-hidden">
                      <Dialog.Title
                        as="h3"
                        className="text-base font-semibold leading-6 text-gray-900"
                      >
                        Failed while refreshing{' '}
                        {dataSourcePrettyName(props.config.type)}{' '}
                        <span className="font-mono bg-gray-100 px-1 py-0.5">
                          {props.config.data.name ?? ''}
                        </span>{' '}
                        schema.
                      </Dialog.Title>
                      <div className="flex flex-col gap-y-2 text-gray-500 text-sm">
                        <p className="py-1 pb-1">
                          {
                            'We tried to fetch your data source schema but we got an error.'
                          }
                        </p>
                        {error}
                        <p className="pt-1">
                          Please double check your credentials and permissions.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 mt-4 flex justify-end gap-x-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex rounded-sm shadow-sm bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex rounded-sm shadow-sm bg-primary-200 px-3 py-2 text-sm text-gray-900 font-medium hover:bg-primary-300"
                    >
                      Retry
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
