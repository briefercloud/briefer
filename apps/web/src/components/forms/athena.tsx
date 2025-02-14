import type { AthenaDataSource } from '@briefer/database'
import Link from 'next/link'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { GATEWAY_IP } from '@/utils/info'

import FormError from './formError'
import Spin from '../Spin'
import FileUploadInput from './FileUploadInput'
import { readFile } from '@/utils/file'

export type AthenaDataSourceInput = AthenaDataSource & {
  accessKeyId: string
  secretAccessKeyId: string
  additionalInfo?: string
}

type AthenaDataSourceFormValues = Omit<
  AthenaDataSourceInput,
  'additionalInfo'
> & { additionalInfo: File }

type AthenaFormProps = {
  onSubmit: (values: AthenaDataSourceInput) => Promise<void>
  athenaDataSource?: AthenaDataSource | null
  workspaceId: string
}

export default function AthenaForm({
  athenaDataSource,
  onSubmit,
  workspaceId,
}: AthenaFormProps) {
  const isEditing = Boolean(athenaDataSource)

  const { register, handleSubmit, formState, reset, control } =
    useForm<AthenaDataSourceFormValues>({
      mode: 'onChange',
      defaultValues: { notes: '' },
    })

  useEffect(() => {
    if (athenaDataSource) {
      reset(athenaDataSource)
    }
  }, [athenaDataSource, reset])

  const onSubmitHandler = handleSubmit(async (data) => {
    const additionalInfoFile = data.additionalInfo
    let additionalInfoContent = undefined as string | undefined
    if (additionalInfoFile) {
      additionalInfoContent = await readFile(additionalInfoFile, 'utf-8')
    }

    onSubmit({
      ...data,
      additionalInfo: additionalInfoContent,
    })
  })

  return (
    <form className="px-4 sm:p-6 lg:p-12" onSubmit={onSubmitHandler} noValidate>
      <div className="space-y-12">
        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-lg font-semibold leading-7 text-gray-900">
            {athenaDataSource ? 'Edit' : 'New'} Athena data source
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {athenaDataSource ? 'Edit' : 'Add'} a Athena database for Briefer to
            pull data from. Our fixed IP address is{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded-md text-red-500 text-xs">
              {GATEWAY_IP()}
            </code>
            .
          </p>

          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-6">
            <div className="col-span-6">
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
                  placeholder="My Athena database"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.name?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="region"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                AWS region
              </label>
              <div className="mt-2">
                <input
                  {...register('region', {
                    required: {
                      value: true,
                      message: 'AWS region is required.',
                    },
                  })}
                  type="text"
                  name="region"
                  placeholder="us-east-1"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.region?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="s3OutputPath"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                S3 output path
              </label>
              <div className="mt-2">
                <input
                  {...register('s3OutputPath', {
                    required: {
                      value: true,
                      message: 'S3 output path is required.',
                    },
                  })}
                  type="text"
                  name="s3OutputPath"
                  placeholder="s3://my-bucket/my-folder/"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.region?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="accessKeyId"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                AWS Access Key ID
              </label>
              <div className="mt-2">
                <input
                  {...register('accessKeyId', {
                    required: {
                      value: !isEditing,
                      message: 'AWS Access Key ID is required.',
                    },
                  })}
                  type="password"
                  name="accessKeyId"
                  required={!isEditing}
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                {isEditing && !Boolean(formState.errors.accessKeyId) && (
                  <span className="block text-sm text-gray-900 empty:before:content-['\200b'] pt-1 pb-1">
                    Leave empty to keep previous Access Key ID
                  </span>
                )}
                <FormError msg={formState.errors.accessKeyId?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="secretAccessKeyId"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                AWS Secret Access Key ID
              </label>
              <div className="mt-2">
                <input
                  {...register('secretAccessKeyId', {
                    required: {
                      value: !isEditing,
                      message: 'AWS Secret Access Key ID is required.',
                    },
                  })}
                  type="password"
                  name="secretAccessKeyId"
                  required={!isEditing}
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                {isEditing && !Boolean(formState.errors.accessKeyId) && (
                  <span className="block text-sm text-gray-900 empty:before:content-['\200b'] pt-1 pb-1">
                    Leave empty to keep previous Secret Access Key ID
                  </span>
                )}
                <FormError msg={formState.errors.accessKeyId?.message} />
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
