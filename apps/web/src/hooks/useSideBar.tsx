import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from 'react'
import { useStringQuery } from './useQueryArgs'

type Context = [boolean, Dispatch<SetStateAction<boolean>>]
const Context = createContext<Context>([true, () => {}] as unknown as Context)

export default function useSideBar(): Context {
  return useContext(Context)
}

export function SideBarProvider({ children }: { children: React.ReactNode }) {
  const noSidebarQs = useStringQuery('sidebarCollapsed')
  const value = useState(noSidebarQs === 'true')

  return <Context.Provider value={value}>{children}</Context.Provider>
}
