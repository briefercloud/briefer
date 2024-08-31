import { DependencyList, useCallback, useRef, useEffect } from 'react'

export const useDebounce = (
  callback: Function,
  delay: number,
  deps?: DependencyList
) => {
  const functionRef = useRef<Function>(callback)
  const debounceRef = useRef<(...args: any[]) => void>()

  // Update callback in ref on change
  useEffect(() => {
    functionRef.current = callback
  }, [callback])

  useEffect(() => {
    debounceRef.current = debounce(
      (...args: any) => functionRef.current(...args),
      delay
    )
  }, [delay])

  return useCallback(
    (...args: any[]) => {
      debounceRef.current!(...args)
    },
    deps ? [...deps] : []
  )
}

function debounce(func: Function, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: any) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}
