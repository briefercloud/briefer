import Link from 'next/link'
import { PuzzlePieceIcon } from '@heroicons/react/24/outline'

interface Props {
  workspaceId: string
}
export default function IntegrationsList(props: Props) {
  return <EmptyIntegrations workspaceId={props.workspaceId} />
}

function EmptyIntegrations(props: { workspaceId: string }) {
  return (
    <div className="py-6">
      <Link href={`/workspaces/${props.workspaceId}/integrations/new`}>
        <div className="text-center py-12 bg-ceramic-50/60 rounded-xl">
          <PuzzlePieceIcon className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">
            No integrations
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Click here to add an integration
          </p>
        </div>
      </Link>
    </div>
  )
}
