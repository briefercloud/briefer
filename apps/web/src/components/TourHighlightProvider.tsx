import React, { createContext, useContext, useState, ReactNode } from 'react'
import TourHighlight from './TourHighlight'

interface TourHighlightContextType {
  selector: string | null
  setSelector: (selector: string | null) => void
  isTourActive: boolean
  setTourActive: (active: boolean) => void
}

const TourHighlightContext = createContext<
  TourHighlightContextType | undefined
>(undefined)

export const TourHighlightProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selector, setSelector] = useState<string | null>(null)
  const [isTourActive, setTourActive] = useState(false)

  return (
    <TourHighlightContext.Provider
      value={{ selector, setSelector, isTourActive, setTourActive }}
    >
      <TourHighlight />
      {children}
    </TourHighlightContext.Provider>
  )
}

type UseTourHighlightState = {
  selector: string | null
  isTourActive: boolean
}

type UseTourHighlightAPI = {
  setSelector: (selector: string | null) => void
  setTourActive: (active: boolean) => void
}

export const useTourHighlight: () => [
  UseTourHighlightState,
  UseTourHighlightAPI
] = () => {
  const context = useContext(TourHighlightContext)
  if (!context) {
    console.warn('useTourHighlight must be used within a TourHighlightProvider')
    return [
      { selector: null, isTourActive: false },
      { setSelector: () => {}, setTourActive: () => {} },
    ]
  }
  return [
    { selector: context.selector, isTourActive: context.isTourActive },
    {
      setSelector: context.setSelector,
      setTourActive: context.setTourActive,
    },
  ]
}
