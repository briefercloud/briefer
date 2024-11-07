import {
  PivotTableColumn,
  PivotTableMetric,
  PivotTableRow,
} from '@briefer/editor'
import { DataFrame } from '@briefer/types'
import clsx from 'clsx'
import { useCallback } from 'react'
import PivotTableGroup from './PivotTableGroup'

interface Props {
  dataframe: DataFrame | null
  rows: PivotTableRow[]
  onChangeRows: (rows: PivotTableRow[]) => void

  columns: PivotTableColumn[]
  onChangeColumns: (columns: PivotTableColumn[]) => void

  metrics: PivotTableMetric[]
  onChangeMetrics: (metrics: PivotTableMetric[]) => void

  isHidden: boolean
  isEditable: boolean
}
function PivotTableControls(props: Props) {
  const onAddRow = useCallback(() => {
    props.onChangeRows([...props.rows, { column: null }])
  }, [props.rows, props.onChangeRows])

  const onRemoveRow = useCallback(
    (index: number) => {
      if (props.rows.length === 1) {
        return
      }

      const newRows = props.rows.filter((_, i) => i !== index)
      props.onChangeRows(newRows)
    },
    [props.rows, props.onChangeRows]
  )

  const onAddColumn = useCallback(() => {
    props.onChangeColumns([...props.columns, { column: null }])
  }, [props.columns, props.onChangeColumns])

  const onRemoveColumn = useCallback(
    (index: number) => {
      if (props.columns.length === 1) {
        return
      }

      const newColumns = props.columns.filter((_, i) => i !== index)
      props.onChangeColumns(newColumns)
    },
    [props.columns, props.onChangeColumns]
  )

  const onAddMetric = useCallback(() => {
    props.onChangeMetrics([
      ...props.metrics,
      { column: null, aggregateFunction: 'count' },
    ])
  }, [props.metrics, props.onChangeMetrics])

  const onRemoveMetric = useCallback(
    (index: number) => {
      if (props.metrics.length === 1) {
        return
      }

      const newMetrics = props.metrics.filter((_, i) => i !== index)
      props.onChangeMetrics(newMetrics)
    },
    [props.metrics, props.onChangeMetrics]
  )

  return (
    <div
      className={clsx(
        'h-full relative shadow-[2px_0_5px_-4px_#888] overflow-y-auto z-10',
        props.isHidden ? 'w-0' : 'w-1/3 border-r border-gray-200'
      )}
    >
      <div
        className={clsx(
          'flex flex-col items-center',
          props.isHidden ? 'hidden' : 'block'
        )}
      >
        <div className="w-full h-full px-4 py-5">
          <div className="text-xs text-gray-500 flex flex-col space-y-8">
            <PivotTableGroup
              dataframe={props.dataframe}
              label="Rows"
              addLabel="Add Row"
              values={props.rows}
              valueLabel={(_, i) => `Row ${i + 1}`}
              onChange={props.onChangeRows}
              onAdd={onAddRow}
              onRemove={onRemoveRow}
              isEditable={props.isEditable}
            />
            <PivotTableGroup
              dataframe={props.dataframe}
              label="Columns"
              addLabel="Add Column"
              values={props.columns}
              valueLabel={(_, i) => `Column ${i + 1}`}
              onChange={props.onChangeColumns}
              onAdd={onAddColumn}
              onRemove={onRemoveColumn}
              isEditable={props.isEditable}
            />
            <PivotTableGroup
              dataframe={props.dataframe}
              label="Metrics"
              addLabel="Add Metric"
              values={props.metrics}
              valueLabel={(_, i) => `Metric ${i + 1}`}
              onChange={props.onChangeMetrics}
              onAdd={onAddMetric}
              onRemove={onRemoveMetric}
              isEditable={props.isEditable}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default PivotTableControls
