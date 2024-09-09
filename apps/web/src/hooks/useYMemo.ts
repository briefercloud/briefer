import { ValueTypes } from '@briefer/editor'
import { DependencyList, useEffect, useState } from 'react'
import * as Y from 'yjs'
import useResettableState from './useResettableState'

export function useYElementMemo<T extends { [key: string]: ValueTypes }, R>(
  cb: (v: Y.XmlElement<T>) => R,
  yVal: Y.XmlElement<T>,
  deps: DependencyList
) {
  const [result, setResult] = useState(cb(yVal))
  useEffect(() => {
    function observe() {
      setResult(cb(yVal))
    }

    yVal.observe(observe)
    setResult(cb(yVal))

    return () => {
      yVal.unobserve(observe)
    }
  }, [yVal, ...deps])

  return result
}

interface YObservable {
  observeDeep: (fn: () => void) => void
  unobserveDeep: (fn: () => void) => void
}
export function useYMemo<O extends YObservable, T>(
  observable: O,
  fn: (observable: O) => T,
  deps: DependencyList
) {
  const [value, setValue] = useResettableState<T>(fn(observable), deps)

  useEffect(() => {
    const onUpdate = () => {
      setValue(fn(observable))
    }

    observable.observeDeep(onUpdate)

    return () => {
      observable.unobserveDeep(onUpdate)
    }
  }, [observable, ...deps])

  return value
}
