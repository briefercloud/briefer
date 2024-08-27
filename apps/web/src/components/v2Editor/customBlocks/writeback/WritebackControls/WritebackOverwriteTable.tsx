import VisualizationToggle from '../../visualization/VisualizationToggle'

interface Props {
  value: boolean
  onChange: (value: boolean) => void
  disabled: boolean
}
function WritebackOverwriteTable(props: Props) {
  return (
    <VisualizationToggle
      label="Overwrite table"
      enabled={props.value}
      onToggle={props.onChange}
      disabled={props.disabled}
    />
  )
}

export default WritebackOverwriteTable
