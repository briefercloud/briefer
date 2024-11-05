import Layout from '@/components/Layout'
import { useRouter } from 'next/router'
import {
  UsersIcon,
  UserPlusIcon,
  Cog8ToothIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import { useStringQuery } from '@/hooks/useQueryArgs'
import { useUsers } from '@/hooks/useUsers'
import UserForm, { UserFormValues } from '@/components/forms/user'
import { MouseEventHandler, useCallback, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { EyeIcon } from '@heroicons/react/24/solid'
import copy from 'copy-to-clipboard'
import { PortalTooltip } from '@/components/Tooltips'
import useResettableState from '@/hooks/useResettableState'
import { UserRoundCheck } from 'lucide-react'
import ScrollBar from '@/components/ScrollBar'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Users',
    icon: UsersIcon,
    href: `/workspaces/${workspaceId}/users`,
    current: false,
  },
  {
    name: 'Add user',
    icon: UserPlusIcon,
    href: '#',
    current: true,
  },
]

export default function NewUserPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')
  const [_users, { createUser }] = useUsers(workspaceId)
  const [user, setUser] = useState<{ name: string; password: string } | null>(
    null
  )

  const onSubmit = useCallback(
    async (data: UserFormValues) => {
      try {
        const user = await createUser(data)
        if (user.password) {
          setUser({ name: user.name, password: user.password })
        } else {
          router.push(`/workspaces/${workspaceId}/users`)
        }
      } catch (e) {
        console.error(e)
        alert('Something went wrong')
      }
    },
    [createUser, router, workspaceId]
  )

  const onClosePasswordDialog = useCallback(() => {
    router.push(`/workspaces/${workspaceId}/users`)
    setUser(null)
  }, [router, workspaceId])

  return (
    <Layout pagePath={pagePath(workspaceId)}>
      <ScrollBar className="w-full overflow-auto">
        <UserForm workspaceId={workspaceId} onSubmit={onSubmit} />
      </ScrollBar>
      <PasswordDialog
        user={user}
        onClose={onClosePasswordDialog}
        isReset={false}
      />
    </Layout>
  )
}

interface PasswordDialogProps {
  user: { name: string; password: string } | null
  onClose: () => void
  isReset: boolean
}
export function PasswordDialog(props: PasswordDialogProps) {
  const [hidden, setHidden] = useResettableState(() => true, [props.user])

  const [copied, setCopied] = useState(false)
  const onCopy: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      if (!props.user) {
        return
      }
      e.preventDefault()
      copy(props.user.password)
      setCopied(true)
    },
    [props.user, setCopied]
  )

  useEffect(() => {
    if (copied) {
      setTimeout(() => {
        setCopied(false)
      }, 1500)
    }
  }, [copied])

  return (
    <Transition show={props.user !== null}>
      <Dialog onClose={() => {}} className="relative z-[100]">
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    {props.isReset ? (
                      <LockClosedIcon className="h-6 w-6 text-green-600" />
                    ) : (
                      <UserRoundCheck
                        aria-hidden="true"
                        className="h-6 w-6 text-green-600"
                      />
                    )}
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      {props.isReset
                        ? `We got ${props.user?.name} a new password`
                        : `Time to welcome ${props.user?.name} to Briefer`}
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {props.isReset
                          ? `Here's their new random password. Make sure to share it with them. You'll not be able to see it again.`
                          : `Here's the random password we generated for ${props.user?.name}. Make sure to share it with them. You'll not be able to see it again.`}
                      </p>
                      <div className="my-8 relative">
                        <input
                          type={hidden ? 'password' : 'text'}
                          name="password"
                          className="block w-full rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 sm:text-md sm:leading-6"
                          value={props.user?.password}
                          disabled
                        />
                        <div className="flex items-center absolute inset-y-0 right-0">
                          <PortalTooltip
                            content={
                              <div className="font-sans bg-hunter-950 text-white text-center text-xs p-2 rounded-md w-24 -translate-x-1/2">
                                {copied ? 'Copied!' : 'Click to copy'}
                              </div>
                            }
                          >
                            <button
                              type="button"
                              className="group flex items-center"
                              onClick={onCopy}
                            >
                              <ClipboardDocumentIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                            </button>
                          </PortalTooltip>
                          <button
                            type="button"
                            onClick={() => setHidden(!hidden)}
                            className="group flex items-center pl-1.5 pr-3"
                          >
                            {hidden ? (
                              <EyeIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                            ) : (
                              <EyeSlashIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6">
                  <button
                    type="button"
                    onClick={props.onClose}
                    className="mt-3 inline-flex w-full justify-center rounded-sm bg-primary-200 px-3 py-2 text-sm text-gray-900 font-medium hover:bg-primary-300 sm:col-start-1 sm:mt-0"
                  >
                    Continue
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
