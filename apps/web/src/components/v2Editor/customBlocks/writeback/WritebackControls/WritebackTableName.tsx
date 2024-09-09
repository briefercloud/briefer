import useYTextInput from '@/hooks/useYTextInput'
import { useCallback } from 'react'
import * as Y from 'yjs'

interface Props {
  name: Y.Text
  disabled: boolean
}
function WritebackTableName(props: Props) {
  const { value, onChange } = useYTextInput(props.name)
  const onChangeInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  return (
    <div className="text-xs text-gray-500">
      <label
        htmlFor="tableName"
        className="block text-xs font-medium leading-6 text-gray-900 pb-1"
      >
        Table
      </label>
      <input
        name="tableName"
        type="text"
        placeholder="table_{{you_can_use_vars}}"
        className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed h-9"
        value={value}
        onChange={onChangeInput}
        disabled={props.disabled}
      />
    </div>
  )
}

export default WritebackTableName
