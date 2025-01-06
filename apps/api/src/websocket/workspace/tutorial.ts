import { getTutorialState } from '../../tutorials.js'
import { IOServer } from '../index.js'

export async function broadcastTutorialStepStates(
  socket: IOServer,
  workspaceId: string,
  tutorialType: 'onboarding'
) {
  const tutorialState = await getTutorialState(workspaceId, tutorialType)

  if (!tutorialState) {
    return
  }

  socket.to(workspaceId).emit('workspace-tutorial-update', {
    workspaceId,
    tutorialType,
    tutorialState,
  })
}
