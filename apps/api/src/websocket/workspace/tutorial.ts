import { getTutorialStepStates } from '../../tutorials.js'
import { IOServer } from '../index.js'

export async function broadcastTutorialStepStates(
  socket: IOServer,
  workspaceId: string,
  tutorialType: 'onboarding'
) {
  const tutorialStepStates = await getTutorialStepStates(
    workspaceId,
    tutorialType
  )

  if (!tutorialStepStates) {
    return
  }

  socket.to(workspaceId).emit('workspace-tutorial-update', {
    workspaceId,
    tutorialType,
    tutorialStepStates,
  })
}
