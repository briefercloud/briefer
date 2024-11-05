import { Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/20/solid'
import Layout from '@/components/Layout'
import Spin from '@/components/Spin'
import FormError from '@/components/forms/formError'
import { useSession } from '@/hooks/useAuth'
import { useStringQuery } from '@/hooks/useQueryArgs'
import { useUsers } from '@/hooks/useUsers'
import { ApiUser } from '@briefer/database'
import { UserIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

const pagePath = [{ name: 'Profile', icon: UserIcon, href: '#', current: true }]

type FormValues = {
  name: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

function ProfilePage() {
  const workspaceId = useStringQuery('workspaceId')
  const session = useSession()

  const onSuccess = useCallback(() => {
    session.mutate()
  }, [session])

  if (!session.data || !workspaceId) {
    return null
  }

  return (
    <Profile
      workspaceId={workspaceId}
      user={session.data}
      onSuccess={onSuccess}
    />
  )
}

interface Props {
  workspaceId: string
  user: ApiUser
  onSuccess: () => void
}
function Profile(props: Props) {
  const { register, formState, handleSubmit, getValues, setError, reset } =
    useForm<FormValues>({
      mode: 'onSubmit',
      reValidateMode: 'onSubmit',
      values: {
        name: props.user.name,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      },
    })

  const [success, setSuccess] = useState(false)
  const onCloseSuccessNotificaiton = useCallback(() => {
    setSuccess(false)
  }, [])

  const [, { updateUser }] = useUsers(props.workspaceId)

  const onSuccess = useCallback(() => {
    reset()
    props.onSuccess()
    setSuccess(true)
  }, [reset, props.onSuccess])

  const onSubmitHandler = useCallback(
    async (data: FormValues) => {
      try {
        const reason = await updateUser(props.user.id, data)
        if (!reason) {
          onSuccess()
          return
        }

        switch (reason) {
          case 'forbidden':
            alert('You are not allowed to perform this action.')
            break
          case 'invalid-payload':
            alert('Something went wrong')
            break
          case 'incorrect-password':
            setError('currentPassword', {
              type: 'manual',
              message: 'Incorrect password',
            })
            break
        }
      } catch (err) {
        alert('Something went wrong')
      }
    },
    [reset, props.onSuccess]
  )

  return (
    <Layout pagePath={pagePath}>
      <div className="w-full flex justify-center">
        <div className="w-full scrollable-div">
          <form
            className="px-4 sm:p-6 lg:p-12"
            onSubmit={handleSubmit(onSubmitHandler)}
            noValidate
          >
            <div className="border-b border-gray-900/10 pb-6">
              <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                <div className="col-span-3 pb-6">
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
                <div className="col-span-3 lg:col-span-1 pb-6">
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Current password
                  </label>
                  <div className="mt-2">
                    <input
                      {...register('currentPassword', {
                        validate: (value) => {
                          const { newPassword, confirmPassword } = getValues()
                          if (
                            value.length === 0 &&
                            (newPassword.length > 0 ||
                              confirmPassword.length > 0)
                          ) {
                            return 'Current password is required for changing password.'
                          }
                        },
                      })}
                      type="password"
                      name="currentPassword"
                      className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                    />
                    {!Boolean(formState.errors.currentPassword) && (
                      <span className="block text-sm text-gray-900 empty:before:content-['\200b'] pt-1 pb-1">
                        Leave empty to keep previous password
                      </span>
                    )}
                    <FormError
                      msg={formState.errors.currentPassword?.message}
                    />
                  </div>
                </div>

                <div className="col-span-3 lg:col-span-1 pb-6">
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    New password
                  </label>
                  <div className="mt-2">
                    <input
                      {...register('newPassword', {
                        validate: (value) => {
                          const { currentPassword, confirmPassword } =
                            getValues()
                          if (
                            currentPassword.length === 0 &&
                            value.length === 0
                          ) {
                            return true
                          }

                          if (
                            value.length === 0 &&
                            (currentPassword.length > 0 ||
                              confirmPassword.length > 0)
                          ) {
                            return 'New password is required for changing password.'
                          }

                          if (value.length < 6) {
                            return 'New password is too short.'
                          }
                        },
                      })}
                      type="password"
                      name="newPassword"
                      className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                    />
                    <FormError msg={formState.errors.newPassword?.message} />
                  </div>
                </div>
                <div className="col-span-3 lg:col-span-1 pb-6">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium leading-6 text-gray-900"
                  >
                    Confirm new password
                  </label>
                  <div className="mt-2">
                    <input
                      {...register('confirmPassword', {
                        validate: (value) => {
                          const { currentPassword, newPassword } = getValues()
                          if (
                            value.length === 0 &&
                            (currentPassword.length > 0 ||
                              newPassword.length > 0)
                          ) {
                            return 'Confirm new password is required for changing password.'
                          }

                          if (value !== newPassword) {
                            return 'New password and confirm password do not match.'
                          }
                        },
                      })}
                      type="password"
                      name="confirmPassword"
                      className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                    />
                    <FormError
                      msg={formState.errors.confirmPassword?.message}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-x-4">
              <Link
                href={`/workspaces/${props.workspaceId}`}
                className="text-sm font-semibold leading-6 text-gray-600 border border-gray-200 px-6 py-1.5 rounded-sm shadow-sm hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="flex items-center gap-x-2 rounded-sm shadow-sm bg-primary-200 px-6 py-2.5 text-sm font-semibold hover:bg-primary-300 border-stone-950 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={formState.isSubmitting}
              >
                Save {formState.isSubmitting && <Spin />}
              </button>
            </div>
          </form>
        </div>
      </div>
      <SuccessNotification
        show={success}
        onClose={onCloseSuccessNotificaiton}
      />
    </Layout>
  )
}

function SuccessNotification(props: { show: boolean; onClose: () => void }) {
  return (
    <>
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          {/* Notification panel, dynamically insert this into the live region when it needs to be displayed */}
          <Transition show={props.show}>
            <div className="pointer-events-auto max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition data-[closed]:data-[enter]:translate-y-2 data-[enter]:transform data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-100 data-[enter]:ease-out data-[leave]:ease-in data-[closed]:data-[enter]:sm:translate-x-2 data-[closed]:data-[enter]:sm:translate-y-0 w-80">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="h-6 w-6 text-green-400"
                    />
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">
                      Profile successfully updated!
                    </p>
                  </div>
                  <div className="ml-4 flex flex-shrink-0">
                    <button
                      type="button"
                      onClick={props.onClose}
                      className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </>
  )
}

export default ProfilePage
