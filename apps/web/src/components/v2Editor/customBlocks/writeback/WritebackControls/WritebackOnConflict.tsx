import Dropdown from '@/components/Dropdown'
import { useCallback } from 'react'

const options = [
  { label: 'Update', value: 'update' },
  { label: 'Ignore', value: 'ignore' },
]

interface Props {
  value: 'update' | 'ignore'
  onChange: (value: 'update' | 'ignore') => void
  disabled: boolean
}
function WritebackOnConflict(props: Props) {
  const onChange = useCallback(
    (newValue: string) => {
      if (newValue === 'update') {
        props.onChange('update')
      } else if (newValue === 'ignore') {
        props.onChange('ignore')
      }
    },
    [props.onChange]
  )

  return (
    <Dropdown
      label="On conflict"
      options={options}
      value={props.value}
      onChange={onChange}
      placeholder="Select an option"
      disabled={props.disabled}
    />
  )
}

export default WritebackOnConflict
