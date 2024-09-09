import { DependencyList, useEffect, useRef } from 'react'

type Effect<T> = (prev: T) => void | (() => void)
function usePreviousEffect<T>(
  effect: Effect<T>,
  value: T,
  deps?: DependencyList
) {
  const ref = useRef(value)

  useEffect(() => {
    const prev = ref.current
    ref.current = value
    return effect(prev)
  }, (deps ?? []).concat([value]))
}

export default usePreviousEffect
