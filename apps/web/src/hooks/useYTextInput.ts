import { updateYText } from '@briefer/editor'
import { useCallback, useEffect, useState } from 'react'
import * as Y from 'yjs'

type UseYTextInput = {
  value: string
  onChange: (value: string) => void
}
function useYTextInput(text: Y.Text): UseYTextInput {
  const [value, setValue] = useState(text.toString())
  useEffect(() => {
    const onTextChange = () => {
      setValue(text.toString())
    }
    text.observe(onTextChange)
    return () => {
      text.unobserve(onTextChange)
    }
  }, [text])

  const onChange = useCallback(
    (value: string) => {
      updateYText(text, value)
    },
    [text]
  )

  return { value, onChange }
}

export default useYTextInput
