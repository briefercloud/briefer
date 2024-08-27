import { DependencyList, useCallback } from 'react'

export const useDebounce = (
  callback: Function,
  delay: number,
  deps?: DependencyList
) =>
  useCallback(
    debounce((...args: any) => callback(...args), delay),
    deps ? [callback, delay, ...deps] : [callback, delay]
  )

function debounce(func: Function, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>

  return (...args: any) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}
