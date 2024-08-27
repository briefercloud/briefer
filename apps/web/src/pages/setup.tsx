import Stepper from '@/components/Stepper'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import WorkspaceNameSetupStep, {
  WorkspaceStepFormValues,
} from '@/components/setup/WorkspaceNameForm'
import UserSetupForm, { UserStepFormValues } from '@/components/setup/UserForm'
import { useRouter } from 'next/router'
import useProperties from '@/hooks/useProperties'

function SetupPage() {
  const { isLoading, data: properties } = useProperties()
  const router = useRouter()
  useEffect(() => {
    if (!isLoading && !properties) {
      alert('Something went wrong')
    }

    if (properties && !properties.needsSetup) {
      router.push('/')
    }
  }, [properties, router])

  if (!isLoading && !properties) {
    return <h4>Something went wrong, please try again later</h4>
  }

  if (isLoading || !properties) {
    return null
  }

  return <SetupForm />
}

function SetupForm() {
  const {
    register: registerWorkspaceStep,
    formState: formStateWorkspaceStep,
    control: controlWorkspaceStep,
    handleSubmit: handleSubmitWorkspaceStep,
  } = useForm<WorkspaceStepFormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  })

  const {
    register: registerUserStep,
    formState: formStateUserStep,
    control: controlUserStep,
    handleSubmit: handleSubmitUserStep,
    getValues: getValuesUserStep,
    setError: setErrorUserStep,
  } = useForm<UserStepFormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  })

  const [formValues, setFormValues] = useState<
    WorkspaceStepFormValues & UserStepFormValues
  >({
    workspaceName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [currentStep, setCurrentStep] = useState<'workspace' | 'user'>(
    'workspace'
  )

  const onWorkspaceNameNext = useCallback((values: WorkspaceStepFormValues) => {
    setFormValues((prev) => ({ ...prev, ...values }))
    setCurrentStep('user')
  }, [])

  const router = useRouter()
  const submitHandler = useCallback(
    async (data: UserStepFormValues) => {
      const payload = { ...formValues, ...data }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/sign-up/password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workspaceName: payload.workspaceName,
              name: `${payload.firstName} ${payload.lastName}`,
              email: payload.email,
              password: payload.password,
            }),
          }
        )
        if (res.status === 201) {
          const { loginLink }: { loginLink: string } = await res.json()
          router.push(loginLink)
        } else if (res.status === 400) {
          const { reason } = await res.json()

          switch (reason) {
            case 'user-exists':
              setErrorUserStep('email', {
                type: 'custom',
                message: 'Email already exists',
              })
              break
            case 'invalid-password':
              setErrorUserStep('password', {
                type: 'custom',
                message: 'Password is invalid',
              })
              break
            case 'setup-already-done':
              router.push('/')
              break
            default:
              alert('Something went wrong')
              break
          }
        } else {
          alert('Something went wrong')
        }
      } catch (e) {
        alert('Something went wrong')
      }
    },
    [formValues, formStateUserStep, router, setErrorUserStep]
  )

  const onSetStep = useCallback((step: number) => {
    setCurrentStep(step === 0 ? 'workspace' : 'user')
  }, [])

  const currentForm: JSX.Element = (() => {
    switch (currentStep) {
      case 'workspace':
        return (
          <WorkspaceNameSetupStep
            register={registerWorkspaceStep}
            control={controlWorkspaceStep}
            formErrors={formStateWorkspaceStep.errors}
            handleSubmit={handleSubmitWorkspaceStep}
            onNextStep={onWorkspaceNameNext}
          />
        )
      case 'user':
        return (
          <UserSetupForm
            register={registerUserStep}
            control={controlUserStep}
            formErrors={formStateUserStep.errors}
            handleSubmit={handleSubmitUserStep}
            onNextStep={submitHandler}
            getValues={getValuesUserStep}
            isSubmitting={formStateUserStep.isSubmitting}
          />
        )
    }
  })()

  return (
    <div className="flex flex-col flex-1 bg-white">
      <div className="flex justify-center">
        <Stepper
          steps={['Worskpace', 'User']}
          currentStep={currentStep === 'workspace' ? 0 : 1}
          onSetStep={onSetStep}
        />
      </div>

      {currentForm}
    </div>
  )
}

export default SetupPage
