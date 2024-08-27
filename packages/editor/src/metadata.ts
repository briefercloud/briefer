import * as Y from 'yjs'
import * as z from 'zod'

const Metadata = z.object({
  isDirty: z.boolean(),
})

export type Metadata = z.infer<typeof Metadata>

export type YMetadata = Y.XmlElement<Metadata>

export function getMetadata(yDoc: Y.Doc): YMetadata {
  return yDoc.getXmlElement('metadata')
}

export function isDirty(yDoc: Y.Doc): boolean {
  const metadata = getMetadata(yDoc)
  return metadata.getAttribute('isDirty') ?? false
}

export function setDirty(yDoc: Y.Doc) {
  const metadata = getMetadata(yDoc)
  metadata.setAttribute('isDirty', true)
}

export function setPristine(yDoc: Y.Doc) {
  const metadata = getMetadata(yDoc)
  metadata.setAttribute('isDirty', false)
}
