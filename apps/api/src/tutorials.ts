import prisma from '@briefer/database'
import {
  OnboardingTutorialStep,
  StepStates,
  TutorialState,
} from '@briefer/types'
import { logger } from './logger.js'

const ONBOARDING_STEP_ORDER: OnboardingTutorialStep[] = [
  'connectDataSource',
  'runQuery',
  'runPython',
  'createVisualization',
  'publishDashboard',
  'inviteTeamMembers',
]

export const stepStatesFromStep = (
  stepIds: OnboardingTutorialStep[],
  currentStep: OnboardingTutorialStep,
  isComplete: boolean
): StepStates => {
  const currentStepIndex = stepIds.indexOf(currentStep)

  return stepIds.reduce<StepStates>((acc, stepId, index) => {
    if (isComplete) {
      return { ...acc, [stepId]: 'completed' }
    }

    if (index < currentStepIndex) {
      return { ...acc, [stepId]: 'completed' }
    } else if (index === currentStepIndex) {
      return { ...acc, [stepId]: 'current' }
    } else {
      return { ...acc, [stepId]: 'upcoming' }
    }
  }, {} as StepStates)
}

export const getTutorialState = async (
  workspaceId: string,
  _tutorialType: 'onboarding'
): Promise<TutorialState | null> => {
  const tutorial = await prisma().onboardingTutorial.findUnique({
    where: {
      workspaceId,
    },
  })

  if (!tutorial) {
    return null
  }

  const stepStates = stepStatesFromStep(
    ONBOARDING_STEP_ORDER,
    tutorial.currentStep,
    tutorial.isComplete
  )

  return {
    id: tutorial.id,
    isCompleted: tutorial.isComplete,
    isDismissed: tutorial.isDismissed,
    stepStates,
  }
}

export const advanceTutorial = async (
  workspaceId: string,
  tutorialType: 'onboarding',
  // TODO don't allow null here - this is just for testing
  ifCurrentStep: OnboardingTutorialStep | null
): Promise<TutorialState | null> => {
  const tutorial = await prisma().onboardingTutorial.findUnique({
    where: {
      workspaceId,
    },
  })

  if (!tutorial) {
    logger().error(
      { workspaceId, tutorialType },
      'Trying to advance tutorial that does not exist'
    )
    return null
  }

  if (
    ifCurrentStep &&
    (tutorial.isComplete || tutorial.currentStep !== ifCurrentStep)
  ) {
    return {
      id: tutorial.id,
      isCompleted: tutorial.isComplete,
      isDismissed: tutorial.isDismissed,
      stepStates: stepStatesFromStep(
        ONBOARDING_STEP_ORDER,
        tutorial.currentStep,
        tutorial.isComplete
      ),
    }
  }

  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(tutorial.currentStep)
  const nextStepIndex = currentIndex + 1
  const nextStep = ONBOARDING_STEP_ORDER[nextStepIndex]

  if (nextStepIndex === ONBOARDING_STEP_ORDER.length) {
    await prisma().onboardingTutorial.update({
      where: {
        workspaceId,
      },
      data: {
        isComplete: true,
      },
    })

    return {
      id: tutorial.id,
      isCompleted: true,
      isDismissed: tutorial.isDismissed,
      stepStates: stepStatesFromStep(
        ONBOARDING_STEP_ORDER,
        tutorial.currentStep,
        true
      ),
    }
  }

  if (!nextStep) {
    logger().error(
      { workspaceId, tutorialType },
      'Trying to advance tutorial to a step that does not exist'
    )
    return null
  }

  await prisma().onboardingTutorial.update({
    where: {
      workspaceId,
    },
    data: {
      currentStep: nextStep,
    },
  })

  return {
    id: tutorial.id,
    isCompleted: tutorial.isComplete,
    isDismissed: tutorial.isDismissed,
    stepStates: stepStatesFromStep(
      ONBOARDING_STEP_ORDER,
      nextStep,
      tutorial.isComplete
    ),
  }
}

export const dismissTutorial = async (
  workspaceId: string,
  _tutorialType: 'onboarding'
): Promise<TutorialState | null> => {
  const tutorial = await prisma().onboardingTutorial.update({
    where: {
      workspaceId,
    },
    data: {
      isDismissed: true,
    },
  })

  return {
    id: tutorial.id,
    isCompleted: true,
    isDismissed: tutorial.isDismissed,
    stepStates: stepStatesFromStep(
      ONBOARDING_STEP_ORDER,
      tutorial.currentStep,
      tutorial.isComplete
    ),
  }
}