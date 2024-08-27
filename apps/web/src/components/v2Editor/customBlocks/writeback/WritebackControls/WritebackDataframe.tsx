import { DataFrame } from '@briefer/types'
import { Listbox, Transition } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useCallback, useMemo } from 'react'
import Combobox from '../../visualization/Combobox'
import Dropdown from '@/components/Dropdown'

function search(options: DataFrame[], query: string) {
  return options.filter((c) => {
    return c?.name.toString().toLowerCase().includes(query.toLowerCase())
  })
}

interface Props {
  value: DataFrame | null
  options: DataFrame[]
  onChange: (DataFrame: DataFrame) => void
  disabled: boolean
}
function WritebackDataframe(props: Props) {
  const current = useMemo(() => {
    if (!props.value) {
      return null
    }

    return (
      props.options.find(
        (o) =>
          (o.id && props.value?.id && o.id === props.value.id) ||
          o.name === props.value?.name
      ) ?? null
    )
  }, [props.options, props.value])

  const onChange = useCallback(
    (name: string) => {
      const selected = props.options.find((o) => o.name === name)
      if (!selected) {
        return
      }

      props.onChange(selected)
    },
    [props.onChange, props.options]
  )

  const options = useMemo(
    () => props.options.map((o) => ({ label: o.name, value: o.name })),
    [props.options]
  )

  return (
    <Dropdown
      disabled={options.length === 0 || props.disabled}
      label="Dataframe"
      options={options}
      placeholder={
        options.length === 0 ? 'No dataframes' : 'Select a dataframe'
      }
      value={props.value?.name ?? ''}
      onChange={onChange}
    />
  )
}

export default WritebackDataframe
