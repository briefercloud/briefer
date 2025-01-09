import { ApiUser } from '@briefer/database'
import { NotebookEvents } from './index.js'
import {
  capturePythonRun,
  captureSQLRun,
  captureOnboardingStep,
} from './posthog.js'
import { OnboardingTutorialStep } from '@briefer/types'

export class UserNotebookEvents implements NotebookEvents {
  public constructor(
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly user: ApiUser
  ) {}

  public pythonRun() {
    capturePythonRun(this.user, this.workspaceId, this.documentId)
  }

  public sqlRun() {
    captureSQLRun(this.user, this.workspaceId, this.documentId)
  }

  public visUpdate() {}

  public writeback() {}

  public aiUsage() {}

  public blockAdd() {}

  public advanceOnboarding(onboardingStep: OnboardingTutorialStep) {
    captureOnboardingStep(this.user.id, this.workspaceId, onboardingStep, false)
  }
}
