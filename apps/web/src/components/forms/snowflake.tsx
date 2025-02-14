import type { SnowflakeDataSource } from '@briefer/database'
import Link from 'next/link'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import FormError from './formError'
import { GATEWAY_IP } from '@/utils/info'
import Spin from '../Spin'
import { readFile } from '@/utils/file'
import FileUploadInput from './FileUploadInput'

export type SnowflakeDataSourceInput = SnowflakeDataSource & {
  password: string
  additionalInfo?: string
}

type SnowflakeDataSourceFormValues = Omit<
  SnowflakeDataSourceInput,
  'additionalInfo'
> & {
  additionalInfo: File
}

type SnowflakeFormProps = {
  onSubmit: (values: SnowflakeDataSourceInput) => Promise<void>
  snowflakeDataSource?: SnowflakeDataSource | null
  workspaceId: string
}

export default function SnowflakeForm({
  snowflakeDataSource,
  onSubmit,
  workspaceId,
}: SnowflakeFormProps) {
  const isEditing = Boolean(snowflakeDataSource)

  const { register, handleSubmit, formState, reset, control } =
    useForm<SnowflakeDataSourceFormValues>({
      mode: 'onChange',
      defaultValues: { notes: '' },
    })

  useEffect(() => {
    if (snowflakeDataSource) {
      reset(snowflakeDataSource)
    }
  }, [snowflakeDataSource, reset])

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
            {snowflakeDataSource ? 'Edit' : 'New'} Snowflake data source
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {snowflakeDataSource ? 'Edit' : 'Add'} a Snowflake database for
            Briefer to pull data from. Our fixed IP address is{' '}
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
                  placeholder="My Snowflake database"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.name?.message} />
              </div>
            </div>

            <div className="col-span-4">
              <label
                htmlFor="database"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Database
              </label>
              <div className="mt-2">
                <input
                  {...register('database', {
                    required: {
                      value: true,
                      message: 'Database is required.',
                    },
                  })}
                  type="text"
                  name="database"
                  placeholder="Database name"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.database?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="region"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Region
              </label>
              <div className="mt-2">
                <input
                  {...register('region', {
                    required: {
                      value: true,
                      message: 'Region is required.',
                    },
                  })}
                  type="text"
                  name="region"
                  placeholder="us-east-1"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.database?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="warehouse"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Warehouse
              </label>
              <div className="mt-2">
                <input
                  {...register('warehouse', {
                    required: {
                      value: true,
                      message: 'Warehouse is required.',
                    },
                  })}
                  type="text"
                  name="warehouse"
                  placeholder="EXAMPLE_WH"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.warehouse?.message} />
              </div>
            </div>

            <div className="col-span-4">
              <label
                htmlFor="account"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Account
              </label>
              <div className="mt-2">
                <input
                  {...register('account', {
                    required: {
                      value: true,
                      message: 'Account is required.',
                    },
                  })}
                  type="text"
                  name="account"
                  placeholder="abc12345"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.account?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="user"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                User
              </label>
              <div className="mt-2">
                <input
                  {...register('user', {
                    required: {
                      value: true,
                      message: 'User is required.',
                    },
                  })}
                  type="text"
                  name="user"
                  placeholder="user"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.user?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="password"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Password
              </label>
              <div className="mt-2">
                <input
                  {...register('password', {
                    required: {
                      value: !isEditing,
                      message: 'Password is required.',
                    },
                  })}
                  type="password"
                  name="password"
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                {isEditing && !Boolean(formState.errors.password) && (
                  <span className="block text-sm text-gray-900 empty:before:content-['\200b'] pt-1 pb-1">
                    Leave empty to keep previous password
                  </span>
                )}
                <FormError msg={formState.errors.password?.message} />
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
