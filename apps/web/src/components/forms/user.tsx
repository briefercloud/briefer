import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import FormError from './formError'
import Link from 'next/link'
import Spin from '../Spin'

export const UserFormValues = z.object({
  name: z.string(),
  email: z.string(),
  role: z.enum(['viewer', 'editor', 'admin']),
})

export type UserFormValues = z.infer<typeof UserFormValues>

type UserFormProps = {
  workspaceId: string
  onSubmit: (data: UserFormValues) => Promise<void>
}

export default function UserForm({ workspaceId, onSubmit }: UserFormProps) {
  const { register, formState, handleSubmit } = useForm<UserFormValues>({
    mode: 'onChange',
  })

  const onSubmitHandler = useCallback(
    async (data: UserFormValues) => {
      try {
        await onSubmit(data)
      } catch (e) {
        alert('Something went wrong')
      }
    },
    [onSubmit]
  )

  return (
    <form
      className="px-4 sm:p-6 lg:p-12"
      onSubmit={handleSubmit(onSubmitHandler)}
      noValidate
    >
      <div className="space-y-12">
        <div className="border-b border-gray-900/10 pb-6">
          <h2 className="text-lg font-semibold leading-7 text-gray-900">
            Invite user
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Add a user to the current workspace.
          </p>

          <div className="mt-10 grid xs:grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
            <div className="col-span-1 pb-6">
              <label
                htmlFor="name"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Name
              </label>
              <div className="mt-2">
                <input
                  {...register('name', {
                    required: {
                      value: true,
                      message: 'Name is required.',
                    },
                  })}
                  type="text"
                  name="name"
                  placeholder="John Doe"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.name?.message} />
              </div>
            </div>
            <div className="col-span-1 pb-6">
              <label
                htmlFor="email"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Email
              </label>
              <div className="mt-2">
                <input
                  {...register('email', {
                    required: {
                      value: true,
                      message: 'Email is required.',
                    },
                  })}
                  type="text"
                  name="email"
                  placeholder="john.doe@example.com"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                />
                <FormError msg={formState.errors.email?.message} />
              </div>
            </div>
            <div className="col-span-1 pb-6">
              <label
                htmlFor="role"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Role
              </label>
              <div className="mt-2">
                <select
                  {...register('role', {
                    required: {
                      value: true,
                      message: 'Role is required.',
                    },
                  })}
                  name="role"
                  required
                  className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                >
                  <option value={'viewer'}>Viewer</option>
                  <option value={'editor'}>Editor</option>
                  <option value={'admin'}>Admin</option>
                </select>
                <FormError msg={formState.errors.role?.message} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-x-4">
        <Link
          href={`/workspaces/${workspaceId}/users`}
          className="text-sm font-semibold leading-6 text-gray-600 border border-gray-200 px-6 py-1.5 rounded-sm shadow-sm hover:bg-gray-50"
          onClick={(e) => {
            if (formState.isSubmitting) {
              e.preventDefault()
            }
          }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="flex items-center gap-x-2 rounded-sm shadow-sm bg-primary-200 px-6 py-2.5 text-sm font-semibold hover:bg-primary-300 border-stone-950 disabled:bg-gray-300 disabled:cursor-not-allowed"
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? (
            <>
              <Spin /> Saving
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </form>
  )
}
