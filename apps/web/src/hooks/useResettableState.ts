import {
  useState,
  useEffect,
  useRef,
  DependencyList,
  useMemo,
  SetStateAction,
  Dispatch,
} from 'react'

export default function useResettableState<T>(
  initialValue: () => T,
  deps: DependencyList
): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const valueRef = useRef<() => T>(initialValue)

  useEffect(() => {
    valueRef.current = initialValue
  }, [initialValue])

  useEffect(() => {
    setStoredValue(valueRef.current())
    /* eslint-disable react-hooks/exhaustive-deps */
  }, deps)
  /* eslint-enable react-hooks/exhaustive-deps */

  return useMemo(
    () => [storedValue, setStoredValue],
    [storedValue, setStoredValue]
  )
}
