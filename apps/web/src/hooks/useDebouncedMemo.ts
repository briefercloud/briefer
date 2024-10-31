import { DependencyList, useCallback, useEffect, useState } from 'react'
import debounce from 'lodash/debounce'

export default function useDebouncedMemo<T>(
  factory: () => T,
  deps: DependencyList | undefined,
  timeoutMs: number
): T {
  const [state, setState] = useState(factory())

  const debouncedSetState = useCallback(debounce(setState, timeoutMs), [])

  useEffect(() => {
    debouncedSetState(factory())
  }, deps)

  return state
}
