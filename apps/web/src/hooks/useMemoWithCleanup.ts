import { useEffect, useRef, useState, DependencyList } from 'react'

function useMemoWithCleanUp<T>(
  fn: () => [T, () => void],
  deps: DependencyList
): T {
  const [value, setValue] = useState(fn())
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return value[1]()
    }

    const nextValue = fn()
    setValue(nextValue)
    return nextValue[1]
  }, deps)

  return value[0]
}

export default useMemoWithCleanUp
