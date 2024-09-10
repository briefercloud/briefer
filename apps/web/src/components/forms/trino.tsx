import type { TrinoDataSource } from '@briefer/database'
import Link from 'next/link'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import FormError from './formError'
import { GATEWAY_IP } from '@/utils/info'
import Spin from '../Spin'

export type TrinoDataSourceInput = TrinoDataSource & {
  password: string
}

type TrinoDataSourceFormValues = TrinoDataSourceInput

type TrinoFormProps = {
  onSubmit: (values: TrinoDataSourceInput) => Promise<void>
  trinoDataSource?: TrinoDataSource | null
  workspaceId: string
}

export default function TrinoForm({
  trinoDataSource,
  onSubmit,
  workspaceId,
}: TrinoFormProps) {
  const isEditing = Boolean(trinoDataSource)

  const { register, handleSubmit, formState, reset } =
    useForm<TrinoDataSourceFormValues>({
      mode: 'onChange',
      defaultValues: { readOnly: true },
    })

  useEffect(() => {
    if (trinoDataSource) {
      reset(trinoDataSource)
    }
  }, [trinoDataSource, reset])

  const onSubmitHandler = handleSubmit(async (data) => {
    await onSubmit(data)
  })

  return (
    <form className="px-4 sm:p-6 lg:p-12" onSubmit={onSubmitHandler} noValidate>
      <div className="space-y-12">
        <div className="border-b border-gray-900/10 pb-8">
          <h2 className="text-lg font-semibold leading-7 text-gray-900">
            {trinoDataSource ? 'Edit' : 'New'} Trino data source
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {trinoDataSource ? 'Edit' : 'Add'} a Trino database for Briefer to
            pull data from. Our fixed IP address is{' '}
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
                  placeholder="My Trino database"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.name?.message} />
              </div>
            </div>

            <div className="col-span-7">
              <label
                htmlFor="host"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Host
              </label>
              <div className="mt-2">
                <input
                  {...register('host', {
                    required: { value: true, message: 'Host is required.' },
                  })}
                  type="text"
                  name="host"
                  placeholder="example.com"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.host?.message} />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="port"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Port
              </label>
              <div className="mt-2">
                <input
                  {...register('port', {
                    required: { value: true, message: 'Port is required.' },
                    validate: (v: any) => {
                      v = parseInt(v)
                      if (isNaN(v)) return 'Port must be a number.'
                      return true
                    },
                  })}
                  type="number"
                  name="port"
                  placeholder="5432"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.port?.message} />
              </div>
            </div>

            <div className="col-span-4">
              <label
                htmlFor="database"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Catalog (optional)
              </label>
              <div className="mt-2">
                <input
                  {...register('catalog')}
                  type="text"
                  name="catalog"
                  placeholder="catalog"
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
              </div>
            </div>

            <div className="col-span-3">
              <label
                htmlFor="username"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Username
              </label>
              <div className="mt-2">
                <input
                  {...register('username', {
                    required: {
                      value: true,
                      message: 'Username is required.',
                    },
                  })}
                  type="text"
                  name="username"
                  placeholder="username"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.username?.message} />
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
                  {...register('password')}
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

            <div className="col-span-full">
              <label
                htmlFor="notes"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Notes
              </label>
              <div className="mt-2">
                <textarea
                  {...register('notes', { required: false })}
                  name="notes"
                  rows={3}
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                  defaultValue={''}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Add any notes about this database you may want others to be
                aware of.
              </p>
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
