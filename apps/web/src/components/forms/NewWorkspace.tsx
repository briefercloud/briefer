import { ArrowRightIcon, CheckIcon } from '@heroicons/react/24/outline'
import React, { useCallback, useState } from 'react'

import OnboardingMultiEmail from '@/components/OnboardingMultiEmail'
import WorkspaceUseSelector from '@/components/WorkspaceUseSelector'
import RadioSquares from '@/components/RadioSquares'
import Stepper from '@/components/Stepper'
import { Control, FieldErrors, UseFormRegister, useForm } from 'react-hook-form'
import FormError from '@/components/forms/formError'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useRouter } from 'next/router'
import { z } from 'zod'
import { useSession } from '@/hooks/useAuth'
import Spin from '@/components/Spin'
import clsx from 'clsx'

export const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'me.com',
  'icloud.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'aol.com',
  'protonmail.com',
  'fastmail.com',
  'zoho.com',
  'tutanota.com',
  'yandex.com',
  'mail.com',
  'gmx.com',
  'inbox.com',
  'runbox.com',
  'hushmail.com',
  'lavabit.com',
  'countermail.com',
  'tormail.org',
  'safe-mail.net',
  'elude.in',
  'mailfence.com',
  'disroot.org',
  'riseup.net',
  'autistici.org',
])

const FirstStepFormValues = z.object({
  name: z.string(),
})

type FirstStepFormValues = z.infer<typeof FirstStepFormValues>

const SecondStepFormValues = z.object({
  useContext: z.union([
    z.literal('work'),
    z.literal('personal'),
    z.literal('studies'),
  ]),
  useCases: z.array(z.string()),
  source: z.string(),
})

export type SecondStepFormValues = z.infer<typeof SecondStepFormValues>

const ThirdStepFormValues = z.object({
  inviteEmails: z.array(z.string()),
  allowAllFromDomain: z.boolean(),
})

export type ThirdStepFormValues = z.infer<typeof ThirdStepFormValues>

export const WorkspaceFormValues = z.intersection(
  z.intersection(FirstStepFormValues, SecondStepFormValues),
  ThirdStepFormValues
)

export type WorkspaceFormValues = z.infer<typeof WorkspaceFormValues>

type WorkspaceStepProps<
  T extends FirstStepFormValues | SecondStepFormValues | ThirdStepFormValues
> = {
  onNextStep: (v: T) => void
  formErrors: FieldErrors<T>
  register: UseFormRegister<T>
  control: Control<T>
  handleSubmit: (
    onSubmit: (data: T) => void
  ) => (e: React.BaseSyntheticEvent<object, any, any>) => Promise<void>
}

const WorkspaceNameStep = ({
  onNextStep,
  formErrors,
  register,
  handleSubmit,
}: WorkspaceStepProps<FirstStepFormValues>) => {
  return (
    <form
      className="flex flex-col items-center justify-center py-48 gap-y-6"
      onSubmit={handleSubmit(onNextStep)}
    >
      <h2 className="text-2xl">What&apos;s your workspace name?</h2>

      <div className="relative flex flex-col items-start">
        <input
          type="text"
          id="search"
          className="block w-96 rounded-md border-0 py-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-300 sm:text-xl sm:leading-6"
          placeholder="My Company"
          {...register('name', {
            required: {
              value: true,
              message: 'The workspace name is required',
            },
          })}
        />
        <FormError msg={formErrors.name?.message} />
      </div>

      <button
        type="submit"
        className="flex items-center justify-center gap-x-2 py-2 px-4 bg-primary-200 rounded-sm hover:bg-primary-300 shadow-sm"
      >
        <span>Next</span>
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </form>
  )
}

const SurveyStep = ({
  onNextStep,
  formErrors,
  register,
  handleSubmit,
  control,
}: WorkspaceStepProps<SecondStepFormValues>) => {
  return (
    <form
      className="flex flex-col items-center justify-center gap-y-16 py-8"
      onSubmit={handleSubmit(onNextStep)}
    >
      <h2 className="text-2xl">About your workspace</h2>

      <div className="flex flex-col items-center justify-center gap-y-12 w-[600px]">
        <div className="w-full">
          <label className="block text-md font-medium leading-6 text-gray-900">
            What will you use this workspace for?
          </label>
          <div className="pt-2">
            <RadioSquares
              {...register('useContext', {
                required: {
                  value: true,
                  message: 'You must select one option.',
                },
              })}
              control={control}
              options={[
                { label: 'Work', value: 'work' },
                { label: 'Personal projects', value: 'personal' },
                { label: 'Studies', value: 'studies' },
              ]}
            />
          </div>
          <FormError msg={formErrors.useContext?.message} />
        </div>

        <div className="w-full">
          <label className="block text-md font-medium leading-6 text-gray-900">
            What will you do in this workspace?
          </label>
          <div className="pt-2">
            <WorkspaceUseSelector
              {...register('useCases', {
                required: {
                  value: true,
                  message: 'You must select at least one option.',
                },
              })}
              control={control}
            />
          </div>
          <FormError msg={formErrors.useCases?.message} />
        </div>

        {/* This should be hidden for existing users */}
        <div className="w-full">
          <label className="block text-md font-medium leading-6 text-gray-900">
            How did you hear about us?
          </label>
          <div className="pt-2">
            <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus:ring focus:ring-primary-200 px-2 py-1">
              <input
                className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-md sm:leading-6"
                placeholder="Google, X (Twitter), HackerNews, Influencer ABC..."
                {...register('source', {
                  required: {
                    value: true,
                    message: "We'd love to know how you found us",
                  },
                })}
              />
            </div>
            <FormError msg={formErrors.source?.message} />
          </div>
        </div>
      </div>

      <button
        className="flex items-center justify-center gap-x-2 py-2 px-4 bg-primary-200 rounded-sm hover:bg-primary-300 shadow-sm"
        type="submit"
      >
        <span>Next</span>
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </form>
  )
}

const InviteStep = ({
  register,
  control,
  handleSubmit,
  onNextStep,
  domain,
  isSubmitting,
}: WorkspaceStepProps<ThirdStepFormValues> & {
  domain: string
  isSubmitting: boolean
}) => {
  const isPublicProviderEmail = PERSONAL_DOMAINS.has(domain)

  return (
    <form
      className="flex flex-col items-center justify-center py-48 gap-y-6"
      onSubmit={handleSubmit(onNextStep)}
    >
      <h2 className="text-2xl">Invite others to your new workspace</h2>

      <div className="flex flex-col gap-y-4">
        <div className="relative flex items-center">
          <OnboardingMultiEmail
            {...register('inviteEmails')}
            control={control}
          />
        </div>

        <div
          className={clsx(
            isPublicProviderEmail ? 'hidden' : 'visible',
            'w-96 pb-2'
          )}
        >
          <input
            {...register('allowAllFromDomain')}
            id="allowAllFromDomain"
            type="checkbox"
            className="mt-1 h-4 w-4 text-primary-600 transition duration-150 ease-in-out outline-0 ring-0 focus:ring-0"
          />
          <label
            htmlFor="allowAllFromDomain"
            className="ml-2 text-sm text-gray-600 hover:cursor-pointer"
          >
            Allow anyone with an{' '}
            <span className="font-medium text-gray-900">@{domain}</span> email
            address to access this workspace.
          </label>
        </div>
      </div>

      <button
        className={
          'flex items-center justify-center gap-x-2 py-2 px-4 bg-primary-200 disabled:bg-gray-400 rounded-sm hover:bg-primary-300 disabled:hover:bg-gray-400 shadow-sm'
        }
        type="submit"
        disabled={isSubmitting}
      >
        {!isSubmitting ? <CheckIcon className="h-4 w-4" /> : <Spin />}
        <span>{!isSubmitting ? 'Create workspace' : 'Creating workspace'}</span>
      </button>
    </form>
  )
}

export default function NewWorkspacePage() {
  const {
    register: register1,
    formState: formState1,
    control: control1,
    handleSubmit: handleSubmit1,
  } = useForm<FirstStepFormValues>({
    mode: 'onChange',
  })

  const {
    register: register2,
    formState: formState2,
    control: control2,
    handleSubmit: handleSubmit2,
  } = useForm<SecondStepFormValues>({
    mode: 'onChange',
  })

  const {
    register: register3,
    formState: formState3,
    control: control3,
    handleSubmit: handleSubmit3,
  } = useForm<ThirdStepFormValues>({
    mode: 'onChange',
  })

  const [formValues, setFormValues] = useState<
    FirstStepFormValues & SecondStepFormValues
  >({
    name: '',
    useContext: 'work',
    useCases: [],
    source: '',
  })

  const [currentStep, setCurrentStep] = useState(0)
  const [, { createWorkspace }] = useWorkspaces()
  const router = useRouter()
  const session = useSession()

  const submitHandler = useCallback(
    async (data: ThirdStepFormValues) => {
      const payload = { ...formValues, ...data }

      try {
        const inviteEmails = payload.inviteEmails ?? []
        const workspace = await createWorkspace({
          ...payload,
          inviteEmails,
        })
        router.push(`/workspaces/${workspace.id}/documents`)
      } catch (e) {
        alert('Something went wrong')
      }
    },
    [router, createWorkspace]
  )

  let currentForm = (
    <WorkspaceNameStep
      register={register1}
      control={control1}
      formErrors={formState1.errors}
      handleSubmit={handleSubmit1}
      onNextStep={(values) => {
        setFormValues((prev) => ({ ...prev, name: values.name.trim() }))
        setCurrentStep(1)
      }}
    />
  )
  if (currentStep === 1) {
    currentForm = (
      <SurveyStep
        formErrors={formState2.errors}
        register={register2}
        control={control2}
        handleSubmit={handleSubmit2}
        onNextStep={(values) => {
          setFormValues((prev) => ({
            ...prev,
            useContext: values.useContext,
            useCases: values.useCases,
            source: values.source,
          }))

          setCurrentStep(2)
        }}
      />
    )
  } else if (currentStep === 2) {
    currentForm = (
      <InviteStep
        isSubmitting={formState3.isSubmitting}
        formErrors={formState3.errors}
        register={register3}
        control={control3}
        handleSubmit={handleSubmit3}
        onNextStep={submitHandler}
        domain={session.data?.email?.split('@')[1] ?? ''}
      />
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-white">
      <div className="flex justify-center">
        <Stepper
          steps={['Worskpace name', 'User research', 'Invite users']}
          currentStep={currentStep}
          onSetStep={setCurrentStep}
        />
      </div>

      {currentForm}
    </div>
  )
}
