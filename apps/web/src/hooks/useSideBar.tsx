import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from 'react'

type Context = [boolean, Dispatch<SetStateAction<boolean>>]
const Context = createContext<Context>([true, () => {}] as unknown as Context)

export default function useSideBar(): Context {
  return useContext(Context)
}

export function SideBarProvider({ children }: { children: React.ReactNode }) {
  const value = useState(true)

  return <Context.Provider value={value}>{children}</Context.Provider>
}
