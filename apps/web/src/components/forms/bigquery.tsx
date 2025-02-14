import type { BigQueryDataSource } from '@briefer/database'
import Link from 'next/link'
import { useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'

import FormError from './formError'
import { readFile } from '@/utils/file'
import FileUploadInput from './FileUploadInput'
import { GATEWAY_IP } from '@/utils/info'
import Spin from '../Spin'

async function validateServiceAccountJson(file: File) {
  if (file.type !== 'application/json') {
    return 'Only JSON files are allowed'
  }

  const fileContent = await readFile(file)
  try {
    const fileContentJson = JSON.parse(fileContent)
    const projectId = fileContentJson.project_id
    if (!projectId) {
      return 'Invalid service account JSON file'
    }
  } catch (e) {
    return 'The uploaded file does not contain valid JSON'
  }
}

export type BigQueryDataSourceInput = BigQueryDataSource & {
  serviceAccountKey: string
  additionalInfo?: string
}

export type BigQueryDataSourceFormValues = Omit<
  BigQueryDataSourceInput,
  'serviceAccountKey'
> & {
  serviceAccountKey: File
  additionalInfo: File
}

type BigQueryFormProps = {
  workspaceId: string
  onSubmit: (values: BigQueryDataSourceInput) => Promise<void>
  bigQueryDataSource?: BigQueryDataSource
}

export default function BigQueryForm({
  bigQueryDataSource,
  onSubmit,
  workspaceId,
}: BigQueryFormProps) {
  const isEditing = Boolean(bigQueryDataSource)

  const { register, handleSubmit, formState, reset, control } =
    useForm<BigQueryDataSourceFormValues>({
      mode: 'onChange',
      defaultValues: { notes: '' },
    })

  useEffect(() => {
    if (bigQueryDataSource) {
      reset(bigQueryDataSource)
    }
  }, [bigQueryDataSource, reset])

  const onSubmitHandler = handleSubmit(
    useCallback(
      async (data) => {
        const file = data.serviceAccountKey
        const fileContent = file ? await readFile(file) : ''
        let projectId = ''
        try {
          const asJson = JSON.parse(fileContent)
          projectId = asJson.project_id ?? ''
        } catch (err) {
          void err
        }

        const additionalInfoFile = data.additionalInfo
        let additionalInfoContent = undefined as string | undefined
        if (additionalInfoFile) {
          additionalInfoContent = await readFile(additionalInfoFile, 'utf-8')
        }

        await onSubmit({
          ...data,
          name: data.name,
          serviceAccountKey: fileContent,
          additionalInfo: additionalInfoContent,
          projectId,
          notes: data.notes,
        })
      },
      [onSubmit]
    )
  )

  return (
    <form className="px-4 sm:p-6 lg:p-12" onSubmit={onSubmitHandler} noValidate>
      <div className="space-y-12">
        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-lg font-semibold leading-7 text-gray-900">
            {isEditing ? 'Edit' : 'New'} BigQuery data source
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {bigQueryDataSource ? 'Edit' : 'Add'} a BigQuery instance for
            Briefer to pull data from. Our fixed IP address is{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded-md text-red-500 text-xs">
              {GATEWAY_IP()}
            </code>
            .
          </p>

          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-6">
            <div className="col-span-full">
              <label
                htmlFor="name"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Display name
              </label>
              <div className="mt-2">
                <input
                  {...register('name', {
                    required: {
                      value: true,
                      message: 'Display name is required.',
                    },
                  })}
                  type="text"
                  name="name"
                  placeholder="My BigQuery database"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.name?.message} />
              </div>
            </div>

            <div className="col-span-full">
              <label
                htmlFor="cover-photo"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Service Account JSON
              </label>

              <FileUploadInput
                label="Upload a service account JSON"
                subLabel="or drag and drop your service account JSON file"
                control={control}
                {...register('serviceAccountKey', {
                  required: {
                    value: !isEditing,
                    message: 'Service account key is required.',
                  },
                  validate: !isEditing ? validateServiceAccountJson : undefined,
                })}
              />

              {isEditing && !Boolean(formState.errors.serviceAccountKey) && (
                <span className="block text-sm text-gray-900 empty:before:content-['\200b'] pt-1 pb-1">
                  Leave empty to keep previous service account
                </span>
              )}
            </div>
            <div className="col-span-full pt-8">
              <label
                htmlFor="additionalInfo"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                AI Additional Context{' '}
                <span className="pl-1 text-gray-500">(optional)</span>
              </label>
              <FileUploadInput
                label={
                  isEditing
                    ? 'Upload a new file with additional context for the AI assistant'
                    : 'Upload a file with additional context for the AI assistant'
                }
                subLabel={
                  isEditing
                    ? 'this should be a plain text file (.txt, .json, .yaml, .md, etc.) with examples and descriptions - leave empty to keep the current one'
                    : 'this should be a plain text file (.txt, .json, .yaml, .md, etc.) with examples and descriptions'
                }
                control={control}
                {...register('additionalInfo')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-x-4">
        <Link
          href={`/workspaces/${workspaceId}/data-sources`}
          className="text-sm font-semibold leading-6 text-gray-600 border border-gray-400 px-6 py-1.5 rounded-sm shadow-sm hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="flex items-center justify-center gap-x-2 rounded-sm shadow-sm bg-primary-200 px-6 py-2.5 text-sm font-semibold hover:bg-primary-300 border-stone-950 disabled:bg-gray-300 disabled:cursor-not-allowed"
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? (
            <>
              <Spin /> Validating
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </form>
  )
}
