import type { DatabricksSQLDataSource } from '@briefer/database'
import Link from 'next/link'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import FormError from './formError'
import { GATEWAY_IP } from '@/utils/info'
import Spin from '../Spin'
import FileUploadInput from './FileUploadInput'
import { readFile } from '@/utils/file'

export type DatabricksSQLDataSourceInput = DatabricksSQLDataSource & {
  token: string
  additionalInfo?: string
}

type DatabricksSQLDataSourceFormValues = Omit<
  DatabricksSQLDataSourceInput,
  'additionalInfo'
> & {
  additionalInfo: File
}

type DatabricksSQLFormProps = {
  onSubmit: (values: DatabricksSQLDataSourceInput) => Promise<void>
  databricksSQLDataSource?: DatabricksSQLDataSource | null
  workspaceId: string
}

export default function DatabricksSQLForm({
  databricksSQLDataSource,
  onSubmit,
  workspaceId,
}: DatabricksSQLFormProps) {
  const isEditing = Boolean(databricksSQLDataSource)

  const { register, handleSubmit, formState, reset, control } =
    useForm<DatabricksSQLDataSourceFormValues>({
      mode: 'onChange',
      defaultValues: { notes: '' },
    })

  useEffect(() => {
    if (databricksSQLDataSource) {
      reset(databricksSQLDataSource)
    }
  }, [databricksSQLDataSource, reset])

  const onSubmitHandler = handleSubmit(async (data) => {
    const additionalInfoFile = data.additionalInfo
    let additionalInfoContent = undefined as string | undefined
    if (additionalInfoFile) {
      additionalInfoContent = await readFile(additionalInfoFile, 'utf-8')
    }

    await onSubmit({
      ...data,
      additionalInfo: additionalInfoContent,
    })
  })

  return (
    <form className="px-4 sm:p-6 lg:p-12" onSubmit={onSubmitHandler} noValidate>
      <div className="space-y-12">
        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-lg font-semibold leading-7 text-gray-900">
            {databricksSQLDataSource ? 'Edit' : 'New'} Databricks SQL data
            source
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {databricksSQLDataSource ? 'Edit' : 'Add'} a Databricks SQL database
            for Briefer to pull data from. Our fixed IP address is {''}
            <code className="bg-gray-100 px-1 py-0.5 rounded-md text-red-500 text-xs">
              {GATEWAY_IP()}
            </code>
            .
          </p>

          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-10">
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
                  placeholder="My Databricks SQL database"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.name?.message} />
              </div>
            </div>

            <div className="col-span-10">
              <label
                htmlFor="hostname"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Host Name
              </label>
              <div className="mt-2">
                <input
                  {...register('hostname', {
                    required: {
                      value: true,
                      message: 'Host name is required.',
                    },
                  })}
                  type="text"
                  name="hostname"
                  placeholder="*************.cloud.databricks.com"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.hostname?.message} />
              </div>
            </div>

            <div className="col-span-5">
              <label
                htmlFor="http_path"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                HTTP Path
              </label>
              <div className="mt-2">
                <input
                  {...register('http_path', {
                    required: {
                      value: true,
                      message: 'A HTTP path is required.',
                    },
                  })}
                  type="text"
                  name="http_path"
                  placeholder="/sql/1.0/warehouses/**********"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.http_path?.message} />
              </div>
            </div>

            <div className="col-span-5">
              <label
                htmlFor="token"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Token
              </label>
              <div className="mt-2">
                <input
                  {...register('token')}
                  type="text"
                  name="token"
                  placeholder="dapi*************"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                {isEditing && !Boolean(formState.errors.token) && (
                  <span className="block text-sm text-gray-900 empty:before:content-['\200b'] pt-1 pb-1">
                    Leave empty to keep previous token
                  </span>
                )}
                <FormError msg={formState.errors.token?.message} />
              </div>
            </div>

            <div className="col-span-5">
              <label
                htmlFor="catalog"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Catalog
              </label>
              <div className="mt-2">
                <input
                  {...register('catalog', { required: false })}
                  type="text"
                  name="catalog"
                  placeholder="hive_metastore"
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
              </div>
            </div>

            <div className="col-span-5">
              <label
                htmlFor="schema"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Schema
              </label>
              <div className="mt-2">
                <input
                  {...register('schema', { required: false })}
                  type="text"
                  name="schema"
                  placeholder="default"
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
              </div>
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
