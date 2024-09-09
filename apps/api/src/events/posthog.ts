import { ApiUser, ApiWorkspace } from '@briefer/database'
import { PostHog } from 'posthog-node'
import config from '../config/index.js'

const isJest = process.env['JEST_WORKER_ID'] !== undefined

let posthogClient: PostHog | null
export function getPostHogClient() {
  const conf = config()
  if (conf.DISABLE_ANONYMOUS_TELEMETRY || isJest || posthogClient) {
    return posthogClient
  }

  // It's fine for this to be public because it goes on the client anyway
  posthogClient = new PostHog('phc_hHNB1GN3QFdyn0eMH6VW4dNezbXsbSq4PE5PcL9xbju')
  return posthogClient
}

export const captureWorkspaceCreated = async (
  sender: ApiUser,
  workspace: ApiWorkspace
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: sender.id,
    event: 'workspace_created',
    properties: {
      workspaceId: workspace.id,
      workspaceUseContext: workspace.useContext,
      workspaceUseCases: workspace.useCases,
      workspaceSource: workspace.source,
      creatorId: sender.id,
    },
  })
}

export const captureDatasourceCreated = async (
  sender: ApiUser,
  workspaceId: string,
  datasourceId: string,
  datasourceType: string
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: sender.id,
    event: 'datasource_created',
    properties: {
      workspaceId,
      datasourceId,
      datasourceType,
      creatorId: sender.id,
      userId: sender.id,
    },
  })
}

export const capturePythonRun = async (
  sender: ApiUser,
  workspaceId: string,
  documentId: string
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: sender.id,
    event: 'run_python_v2',
    properties: {
      workspaceId,
      documentId,
      userId: sender.id,
    },
  })
}

export const captureSQLRun = async (
  sender: ApiUser,
  workspaceId: string,
  documentId: string
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: sender.id,
    event: 'run_sql_v2',
    properties: {
      workspaceId,
      documentId,
      userId: sender.id,
    },
  })
}

export const captureSchedulePythonRun = async (
  scheduleId: string,
  workspaceId: string,
  documentId: string
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: scheduleId,
    event: 'run_python_schedule',
    properties: {
      workspaceId,
      documentId,
      scheduleId,
    },
  })
}

export const captureCreateSchedule = async (
  sender: ApiUser,
  workspaceId: string,
  documentId: string
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: sender.id,
    event: 'create_schedule',
    properties: {
      workspaceId,
      documentId,
      userId: sender.id,
    },
  })
}
