import { type UploadedFile } from '@briefer/editor'
import { FilesTableHeader, Row } from './FilesTable'
import { useCallback, useMemo } from 'react'

interface Props {
  file: UploadedFile
  downloadLink: string
  onDelete: (filename: string) => void
  headers: FilesTableHeader[]
  onPythonUsage: (filename: string, type: string) => void
  onQueryUsage: (filename: string, type: string) => void
}

function UploadedFile(props: Props) {
  const status = props.file.status

  const onDelete = useCallback(() => {
    props.onDelete(props.file.name)
  }, [props.onDelete, props.file])


  const onPythonUsage = useCallback(() => {
    props.onPythonUsage(props.file.name, props.file.type)
  }, [props.onPythonUsage, props.file])

  const onQueryUsage = useCallback(() => {
    props.onQueryUsage(props.file.name, props.file.type)
  }, [props.onQueryUsage, props.file])

  const rowFile = useMemo(
    () => ({
      ...props.file,
      uploaded: props.file.size,
      total: props.file.size,
    }),
    [props.file]
  )

  return (
    <Row
      file={rowFile}
      headers={props.headers}
      downloadLink={props.downloadLink}
      isDeleting={status === 'delete-requested' || status === 'deleting'}
      onDelete={onDelete}
      uploading={false}
      error={null}
      onPythonUsage={onPythonUsage}
      onQueryUsage={onQueryUsage}
    />
  )
}

export default UploadedFile
