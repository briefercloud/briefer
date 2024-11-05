import {
  Cog8ToothIcon,
  HandThumbUpIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import React, { useCallback, useMemo } from 'react'

import TrashList from '@/components/TrashList'
import Layout from '@/components/Layout'
import { useStringQuery } from '@/hooks/useQueryArgs'
import { useDocuments } from '@/hooks/useDocuments'
import { ApiDeletedDocument } from '@briefer/database'
import ScrollBar from '@/components/ScrollBar'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Trash',
    icon: TrashIcon,
    href: `/workspaces/${workspaceId}/trash`,
    current: true,
  },
]

export default function TrashPage() {
  const workspaceId = useStringQuery('workspaceId')

  const [state, { restoreDocument, deleteDocument }] = useDocuments(workspaceId)

  const documents = useMemo(
    () =>
      state.documents.filter(
        (doc): doc is ApiDeletedDocument => doc.deletedAt !== null
      ),
    [state.documents]
  )

  const onPermanentDelete = useCallback(
    (id: string) => {
      return deleteDocument(id, true)
    },
    [deleteDocument]
  )

  const onRestore = useCallback(
    (id: string) => {
      return restoreDocument(id)
    },
    [restoreDocument]
  )

  return (
    <Layout pagePath={pagePath(workspaceId ?? '')}>
      <ScrollBar className="w-full bg-white h-full overflow-auto">
        <div className="px-4 sm:p-6 lg:p-8">
          <div className="border-b border-gray-200 pb-4 sm:flex sm:items-center sm:justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Trash
            </h3>
          </div>

          {documents.size === 0 ? (
            <EmptyTrash />
          ) : (
            <TrashList
              workspaceId={workspaceId}
              documents={documents}
              onPermanentDelete={onPermanentDelete}
              onRestore={onRestore}
            />
          )}
        </div>
      </ScrollBar>
    </Layout>
  )
}

function EmptyTrash() {
  return (
    <div className="py-6 ">
      <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-gray-200 border-dashed">
        <HandThumbUpIcon className="h-12 w-12 text-gray-400 mx-auto" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">
          Your trash is empty
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          In the vacuum of bits, your trash bin echoes the mindfulness of
          deletion.
        </p>
      </div>
    </div>
  )
}
