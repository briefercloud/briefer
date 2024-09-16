import { Socket, io } from 'socket.io-client'
import { useSession } from './useAuth'
import { useContext, createContext, useEffect, useState } from 'react'
import { useStringQuery } from './useQueryArgs'
import { validate } from 'uuid'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'

const Context = createContext<Socket | null>(null)

interface Props {
  children: React.ReactNode
}
export function WebsocketProvider({ children }: Props) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const session = useSession()
  const workspaceId = useStringQuery('workspaceId')
  useEffect(() => {
    if (session.data) {
      const url = new URL(NEXT_PUBLIC_API_URL())
      const withoutPathname = url.origin

      const socket = io(withoutPathname, {
        withCredentials: true,
        path: url.pathname === '/' ? undefined : url.pathname + '/socket.io',
        transports: ['websocket'],
      })
      setSocket(socket)

      return () => {
        console.log('disconnect!')
        socket.disconnect()
      }
    }
  }, [session.data, setSocket])

  useEffect(() => {
    if (!socket || !validate(workspaceId)) {
      return
    }

    const onConnect = () => {
      socket.emit('join-workspace', { workspaceId })
    }
    socket.on('connect', onConnect)

    socket.emit('join-workspace', { workspaceId })
    return () => {
      socket.off('connect', onConnect)
      socket.emit('leave-workspace', { workspaceId })
    }
  }, [socket, workspaceId])

  return <Context.Provider value={socket}>{children}</Context.Provider>
}

export default function useWebsocket() {
  return useContext(Context)
}
