import type { UserWorkspaceRole, WorkspaceUser } from '@briefer/database'
import { Menu, Transition } from '@headlessui/react'
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { Fragment, useCallback, useMemo } from 'react'
import useProperties from '@/hooks/useProperties'

type Props = {
  currentUserEmail: string
  users: WorkspaceUser[]
  workspaceId: string
  onRemoveUser: (id: string) => void
  onChangeRole: (id: string, role: UserWorkspaceRole) => void
  onResetPassword: (id: string) => void
  role: UserWorkspaceRole
}
function UsersList(props: Props) {
  const users = useMemo(
    () =>
      props.users.sort((a, b) => {
        if (a.email === props.currentUserEmail) return -1
        if (b.email === props.currentUserEmail) return 1

        if (a.role === 'admin' && b.role !== 'admin') return -1
        if (b.role === 'admin' && a.role !== 'admin') return 1

        if (a.role === 'editor' && b.role === 'viewer') return -1
        if (b.role === 'editor' && a.role === 'viewer') return 1

        return a.name.localeCompare(b.name)
      }),
    [props.users, props.currentUserEmail]
  )

  return (
    <div className="flow-root">
      <div className="overflow-visible">
        <div className="inline-block min-w-full py-2 align-middle">
          <table className="min-w-full">
            <thead className="uppercase text-gray-300 hidden">
              <tr>
                <th
                  scope="col"
                  className="py-3.5 text-left text-sm font-semibold"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="py-3.5 text-left text-sm font-semibold"
                >
                  Title
                </th>
                <th
                  scope="col"
                  className="py-3.5 text-left text-sm font-semibold"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="py-3.5 text-left text-sm font-semibold"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="relative py-3.5 pl-3 pr-4 sm:pr-6 lg:pr-8"
                >
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user) => {
                const isCurrentUser = user.email === props.currentUserEmail

                return (
                  <UserItem
                    key={user.email}
                    user={user}
                    isCurrentUser={isCurrentUser}
                    onRemoveUser={props.onRemoveUser}
                    onChangeRole={props.onChangeRole}
                    onResetPassword={props.onResetPassword}
                    role={props.role}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface UserItemProps {
  user: WorkspaceUser
  isCurrentUser: boolean
  onRemoveUser: (id: string) => void
  onChangeRole: (id: string, role: UserWorkspaceRole) => void
  onResetPassword: (id: string) => void
  role: UserWorkspaceRole
}
function UserItem(props: UserItemProps) {
  const onMakeAdmin = useCallback(() => {
    props.onChangeRole(props.user.id, 'admin')
  }, [props.onChangeRole, props.user.id])

  const onMakeEditor = useCallback(() => {
    props.onChangeRole(props.user.id, 'editor')
  }, [props.onChangeRole, props.user.id])

  const onMakeViewer = useCallback(() => {
    props.onChangeRole(props.user.id, 'viewer')
  }, [props.onChangeRole, props.user.id])

  const onRemoveUser = useCallback(() => {
    props.onRemoveUser(props.user.id)
  }, [props.onRemoveUser, props.user.id])

  const badge = useMemo(() => {
    switch (props.user.role) {
      case 'admin':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Admin
          </Badge>
        )
      case 'editor':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            Editor
          </Badge>
        )
      case 'viewer':
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            Viewer
          </Badge>
        )
    }
  }, [props.user.role])

  const promotions = useMemo(() => {
    return ['admin', 'editor', 'viewer']
      .filter((r) => r !== props.user.role)
      .map((role) => {
        const onClick =
          role === 'admin'
            ? onMakeAdmin
            : role === 'editor'
              ? onMakeEditor
              : onMakeViewer

        return (
          <Menu.Item>
            {({ active }) => {
              return (
                <button
                  onClick={onClick}
                  className={clsx(
                    active ? 'bg-gray-50' : '',
                    'text-gray-700 hover:text-gray-900 cursor-pointer',
                    'text-left w-full px-3 py-1 text-sm leading-6 block'
                  )}
                >
                  Make {role}
                  <span className="sr-only">, {props.user.name}</span>
                </button>
              )
            }}
          </Menu.Item>
        )
      })
  }, [props.user.role])

  const onResetPassword = useCallback(() => {
    props.onResetPassword(props.user.id)
  }, [props.onResetPassword, props.user.id])

  const properties = useProperties()

  return (
    <tr>
      <td className="whitespace-nowrap py-4 text-sm font-medium text-gray-900">
        <span>{props.user.name}</span>{' '}
        {props.isCurrentUser && <span className="text-gray-400">(You)</span>}
      </td>
      <td className="whitespace-nowrap py-4 text-sm text-gray-500">
        {props.user.email}
      </td>
      <td className="whitespace-nowrap py-4 text-sm text-gray-500">
        {new Date(props.user.createdAt).toISOString()}
      </td>
      <td className="whitespace-nowrap py-4 text-sm text-gray-500">{badge}</td>
      <td className="whitespace-nowrap py-4 text-sm font-medium sm:pl-6 lg:pl-8 pr-4">
        <Menu as="div" className="flex items-center justify-end relative">
          <Menu.Button
            as="span"
            className={clsx(
              props.isCurrentUser || props.role !== 'admin'
                ? 'hover:cursor-not-allowed'
                : 'hover:cursor-pointer hover:text-gray-900'
            )}
            disabled={props.isCurrentUser || props.role !== 'admin'}
          >
            <EllipsisVerticalIcon
              className="h-5 w-5 text-gray-400 "
              aria-hidden="true"
            />
            <span className="sr-only">Options for {props.user.name}</span>

            {!props.isCurrentUser && props.role === 'admin' && (
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute text-left right-0 z-10 mt-0.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none hover:cursor-default">
                  {promotions}
                  <Menu.Item>
                    {({ active }) => {
                      return (
                        <button
                          onClick={onResetPassword}
                          className={clsx(
                            active ? 'bg-gray-50' : '',
                            'text-left w-full px-3 py-1 text-sm leading-6 block'
                          )}
                        >
                          Reset password
                          <span className="sr-only">of {props.user.name}</span>
                        </button>
                      )
                    }}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={onRemoveUser}
                        className={clsx(
                          active ? 'bg-gray-50 cursor-pointer' : '',
                          'text-left w-full px-3 py-1 text-sm leading-6 text-red-600 block'
                        )}
                      >
                        Remove
                        <span className="sr-only">, {props.user.name}</span>
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            )}
          </Menu.Button>
        </Menu>
      </td>
    </tr>
  )
}

interface BadgeProps {
  className?: string
  children: React.ReactNode
}
function Badge(props: BadgeProps) {
  return (
    <span
      className={clsx(
        props.className,
        'inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium border'
      )}
    >
      {props.children}
    </span>
  )
}

export default UsersList
