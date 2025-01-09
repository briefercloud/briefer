import { OnboardingTutorialStep } from '@briefer/types'

export interface AIEvents {
  aiUsage: (
    type: 'sql' | 'python',
    action: 'edit' | 'fix',
    modelId: string | null
  ) => void
}

export interface PythonEvents extends AIEvents {
  pythonRun: () => void
  advanceOnboarding: (onboardingStep: OnboardingTutorialStep) => void
}

export interface SQLEvents extends AIEvents {
  sqlRun: () => void
  advanceOnboarding: (onboardingStep: OnboardingTutorialStep) => void
}

export interface VisEvents {
  visUpdate: (chartType: string) => void
  advanceOnboarding: (onboardingStep: OnboardingTutorialStep) => void
}

export interface WritebackEvents extends AIEvents {
  writeback: () => void
}

export interface NotebookBlockEvents {
  blockAdd: (blockType: string) => void
}
export interface NotebookEvents
  extends PythonEvents,
    SQLEvents,
    VisEvents,
    WritebackEvents,
    NotebookBlockEvents {}
