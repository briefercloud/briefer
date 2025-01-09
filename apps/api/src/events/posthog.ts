import { ApiUser, ApiWorkspace, getWorkspaceById } from '@briefer/database'
import { PostHog } from 'posthog-node'
import { config } from '../config/index.js'
import { OnboardingTutorialStep } from '@briefer/types'

const isJest = process.env['JEST_WORKER_ID'] !== undefined

function camelToSnakeCase(input: string): string {
  return input.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

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
  workspace: ApiWorkspace,
  shareEmail: boolean,
  workspaceSource: string | null
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: sender.id,
    event: 'workspace_created',
    properties: {
      workspaceId: workspace.id,
      creatorId: sender.id,
      workspaceName: shareEmail ? workspace.name : null,
      ownerName: shareEmail ? sender.name : null,
      ownerEmail: shareEmail ? sender.email : null,
      workspaceSource,
    },
  })
}

export const captureDatasourceCreated = async (
  sender: ApiUser,
  workspaceId: string,
  workspaceName: string,
  datasourceId: string,
  datasourceType: string
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: sender.id,
    event: 'datasource_created',
    properties: {
      workspaceId,
      workspaceName,
      datasourceId,
      datasourceType,
      creatorId: sender.id,
      userId: sender.id,
    },
  })
}

export const captureDatasourceStatusUpdate = async (
  sender: ApiUser,
  workspaceId: string,
  datasourceId: string,
  datasourceType: string,
  isOnline: boolean
) => {
  const workspace = await getWorkspaceById(workspaceId)
  if (!workspace) {
    return
  }

  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: sender.id,
    event: isOnline ? 'datasource_online' : 'datasource_offline',
    properties: {
      workspaceId,
      workspaceName: workspace.name,
      datasourceId,
      datasourceType,
      creatorId: sender.id,
      userId: sender.id,
    },
  })
  posthog?.flush()
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

export const captureUserCreated = async (
  newUser: ApiUser,
  workspaceId: string,
  workspaceName: string
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: newUser.id,
    event: 'user_created',
    properties: {
      userId: newUser.id,
      workspaceId,
      workspaceName,
    },
  })
}

export const captureOnboardingStep = async (
  userId: string,
  workspaceId: string,
  onboardingStep: OnboardingTutorialStep,
  isSkipped: boolean
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: userId,
    event: `onboarding_${camelToSnakeCase(onboardingStep)}`,
    properties: {
      userId: userId,
      workspaceId: workspaceId,
      isSkipped,
    },
  })
}

export const captureOnboardingDismissed = async (
  userId: string,
  workspaceId: string
) => {
  const posthog = getPostHogClient()
  posthog?.capture({
    distinctId: userId,
    event: `onboarding_dismissed`,
    properties: {
      userId: userId,
      workspaceId: workspaceId,
    },
  })
}
