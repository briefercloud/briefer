import { EventHandler, SyntheticEvent } from 'react'

export const preventPropagation: EventHandler<SyntheticEvent<Element>> = (
  e
) => {
  e.stopPropagation()
}
