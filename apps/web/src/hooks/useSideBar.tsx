import { createContext, useContext, useState, useEffect } from 'react'

type SideBarWidth = number
const MIN_SIDEBAR_WIDTH = 300
const MAX_SIDEBAR_WIDTH = 500
const DEFAULT_SIDEBAR_WIDTH = 320
const DEFAULT_SMALL_SCREEN_WIDTH = 300 // Default width for small screens

// Define the State type as an object with isOpen and width properties
type SideBarState = {
  isOpen: boolean
  width: SideBarWidth
}

// Define the API type with methods to manipulate the state
type SideBarAPI = {
  toggle: (open?: boolean) => void
  resize: (width: SideBarWidth) => void
  open: (state?: boolean) => void
  close: () => void
}

// Combined context type
type Context = {
  state: SideBarState
  api: SideBarAPI
}

// Default context
const initialContext: Context = {
  state: {
    isOpen: true,
    width: DEFAULT_SIDEBAR_WIDTH,
  },
  api: {
    toggle: () => {},
    resize: () => {},
    open: () => {},
    close: () => {},
  },
}

const Context = createContext<Context>(initialContext)

export default function useSideBar(): Context {
  return useContext(Context)
}

export function SideBarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(
    () =>
      new URLSearchParams(location.search).get('sidebarCollapsed') !== 'true'
  )

  const [width, setWidth] = useState<SideBarWidth>(() => {
    // Try to get stored width from localStorage
    const storedWidth = localStorage.getItem('sidebar-width')
    const isSmallScreen = window.innerWidth < 768

    if (isSmallScreen) {
      return DEFAULT_SMALL_SCREEN_WIDTH
    }

    if (storedWidth) {
      const parsedWidth = parseInt(storedWidth, 10)
      if (
        !isNaN(parsedWidth) &&
        parsedWidth >= MIN_SIDEBAR_WIDTH &&
        parsedWidth <= MAX_SIDEBAR_WIDTH
      ) {
        return parsedWidth
      }
    }
    return DEFAULT_SIDEBAR_WIDTH
  })

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebar-width', width.toString())
  }, [width])

  // Update width when window is resized
  useEffect(() => {
    const handleResize = () => {
      const isSmallScreen = window.innerWidth < 768
      if (isSmallScreen && width > DEFAULT_SMALL_SCREEN_WIDTH) {
        setWidth(DEFAULT_SMALL_SCREEN_WIDTH)
      } else if (width < MIN_SIDEBAR_WIDTH) {
        setWidth(MIN_SIDEBAR_WIDTH)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [width, setWidth])

  // Create the state and API objects
  const state: SideBarState = {
    isOpen,
    width,
  }

  const api: SideBarAPI = {
    toggle: (open?: boolean) => {
      if (open !== undefined) {
        setIsOpen(open)
      } else {
        setIsOpen((prevOpen) => !prevOpen)
      }
    },
    resize: (newWidth: SideBarWidth) => {
      const clampedWidth = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, newWidth)
      )
      setWidth(clampedWidth)
    },
    open: (state?: boolean) => {
      if (state !== undefined) {
        setIsOpen(state)
      } else {
        setIsOpen(true)
      }
    },
    close: () => {
      setIsOpen(false)
    },
  }

  return <Context.Provider value={{ state, api }}>{children}</Context.Provider>
}

export {
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  DEFAULT_SMALL_SCREEN_WIDTH,
}
