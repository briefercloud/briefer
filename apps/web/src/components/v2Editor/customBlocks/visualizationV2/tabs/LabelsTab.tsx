import { useCallback } from 'react'
import { DataFrame } from '@briefer/types'
import { VisualizationV2BlockInput } from '@briefer/editor'
import AxisModifierSelector from '@/components/AxisModifierSelector'
import VisualizationToggleV2 from '../VisualizationToggle'

interface LabelsTabProps {
  dataframe: DataFrame | null
  isEditable: boolean
  dataLabels: VisualizationV2BlockInput['dataLabels']
  onChangeDataLabels: (
    dataLabels: VisualizationV2BlockInput['dataLabels']
  ) => void
}

const LabelsTab = ({
  dataframe,
  isEditable,
  dataLabels,
  onChangeDataLabels,
}: LabelsTabProps) => {
  const onToggleShowDataLabels = useCallback(() => {
    onChangeDataLabels({
      ...dataLabels,
      show: !dataLabels.show,
    })
  }, [dataLabels, onChangeDataLabels])

  const onChangeDataLabelsFrequency = useCallback(
    (frequency: string | null) => {
      onChangeDataLabels({
        ...dataLabels,
        frequency: frequency === 'some' ? 'some' : 'all',
      })
    },
    [dataLabels, onChangeDataLabels]
  )

  return (
    <div className="text-xs text-gray-500 flex flex-col space-y-8">
      <div className="flex flex-col gap-y-3">
        <VisualizationToggleV2
          label="Show labels"
          enabled={dataLabels.show}
          onToggle={onToggleShowDataLabels}
        />
        {dataLabels.show && (
          <AxisModifierSelector
            label="Labels to show"
            value={dataLabels.frequency}
            options={[
              { name: 'All', value: 'all' },
              { name: 'Some', value: 'some' },
            ]}
            onChange={onChangeDataLabelsFrequency}
            disabled={!dataframe || !isEditable}
          />
        )}
      </div>
    </div>
  )
}

export default LabelsTab
