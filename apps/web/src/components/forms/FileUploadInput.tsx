import { FieldValues, UseControllerProps, useController } from 'react-hook-form'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import clsx from 'clsx'
import {
  DocumentCheckIcon,
  DocumentPlusIcon,
} from '@heroicons/react/24/outline'
import { XCircleIcon } from '@heroicons/react/24/solid'
import FormError from './formError'

type Props<T extends FieldValues> = UseControllerProps<T> & {
  label: string
  subLabel?: string
}

export default function FileUploadInput<T extends FieldValues>(
  props: Props<T>
) {
  const controller = useController(props)
  const [fileName, setFileName] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const firstFile = acceptedFiles[0]
      if (!firstFile) {
        return
      }

      setFileName(firstFile.name)
      controller.field.onChange(firstFile)
    },
    [setFileName, controller]
  )

  const removeFile: React.MouseEventHandler = useCallback(
    (e) => {
      e.stopPropagation()
      setFileName('')
      controller.field.onChange(null)
    },
    [setFileName, controller]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
  })
  const isSelectionSuccessful =
    !controller.fieldState.error?.message && controller.field.value

  return (
    <div
      className={clsx(
        isSelectionSuccessful
          ? 'border-solid border-primary-400 bg-primary-100/50'
          : 'border-dashed border-gray-900/25',
        isDragActive ? 'bg-primary-50 border-primary-600' : '',
        'flex items-center justify-center rounded-lg border px-6 h-48'
      )}
      {...getRootProps()}
    >
      <div className="text-center">
        {isSelectionSuccessful ? (
          <>
            <div className="flex flex-col items-center justify-center text-sm leading-6 text-gray-600">
              <div className="mx-auto h-12 w-12 text-primary-600 relative">
                <DocumentCheckIcon className="" aria-hidden="true" />
                <XCircleIcon
                  className="h-6 w-6 text-xs text-gray-500 hover:text-red-600 cursor-pointer absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 bg-gray-50 hover:bg-red-50 rounded-full"
                  onClick={removeFile}
                />
              </div>
              <span className="text-sm leading-6 font-semibold text-primary-600 pt-4">
                {fileName}
              </span>
            </div>
          </>
        ) : (
          <>
            <DocumentPlusIcon
              className="mx-auto h-12 w-12 text-gray-300"
              aria-hidden="true"
            />
            <div className="pt-4 flex items-center justify-center text-sm leading-6 text-gray-600">
              <label
                htmlFor="file-upload"
                onClick={(e) => e.preventDefault()}
                className="relative cursor-pointer rounded-md font-semibold text-primary-600 focus-within:outline-none focus-within:ring-0 hover:text-primary-500"
              >
                <span>{props.label}</span>
              </label>
            </div>
            {props.subLabel && (
              <p className="text-sm pl-1 text-gray-500">{props.subLabel}</p>
            )}
            <FormError msg={controller.fieldState.error?.message} />
          </>
        )}

        <input
          id="file-upload"
          type="file"
          className="sr-only"
          {...getInputProps()}
        />
      </div>
    </div>
  )
}
