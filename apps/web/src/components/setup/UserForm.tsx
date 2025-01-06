import { ArrowRightIcon } from '@heroicons/react/24/outline'
import FormError from '@/components/forms/formError'
import {
  Control,
  FieldErrors,
  UseFormHandleSubmit,
  UseFormRegister,
} from 'react-hook-form'
import Spin from '../Spin'
import { Tooltip } from '../Tooltips'
import useProperties from '@/hooks/useProperties'
import clsx from 'clsx'

export type UserStepFormValues = {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  shareEmail: boolean
  source: string
}

interface Props {
  register: UseFormRegister<UserStepFormValues>
  control: Control<UserStepFormValues>
  formErrors: FieldErrors<UserStepFormValues>
  handleSubmit: UseFormHandleSubmit<UserStepFormValues, undefined>
  onNextStep: (values: UserStepFormValues) => void
  getValues: () => UserStepFormValues
  isSubmitting: boolean
}
function UserSetupForm(props: Props) {
  const properties = useProperties()

  return (
    <form
      className="flex flex-col items-center justify-center gap-y-16 py-8"
      onSubmit={props.handleSubmit(props.onNextStep)}
    >
      <h2 className="text-2xl">How should we call you?</h2>
      <div className="flex flex-col items-center justify-center gap-y-2 w-[600px]">
        <div className="flex gap-x-2 w-full">
          <div className="w-full">
            <label className="block text-md font-medium leading-6 text-gray-900">
              First name
            </label>
            <div className="pt-2">
              <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus:ring focus:ring-primary-200 px-2 py-1">
                <input
                  className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-md sm:leading-6"
                  placeholder="John"
                  {...props.register('firstName', {
                    required: {
                      value: true,
                      message: 'First name is required',
                    },
                  })}
                />
              </div>
              <FormError msg={props.formErrors.firstName?.message} />
            </div>
          </div>
          <div className="w-full">
            <label className="block text-md font-medium leading-6 text-gray-900">
              Last name
            </label>
            <div className="pt-2">
              <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus:ring focus:ring-primary-200 px-2 py-1">
                <input
                  className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-md sm:leading-6"
                  placeholder="Doe"
                  {...props.register('lastName', {
                    required: {
                      value: true,
                      message: 'Last name is required',
                    },
                  })}
                />
              </div>
              <FormError msg={props.formErrors.firstName?.message} />
            </div>
          </div>
        </div>
        <div className="w-full">
          <label className="block text-md font-medium leading-6 text-gray-900">
            Email
          </label>
          <div className="pt-2">
            <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus:ring focus:ring-primary-200 px-2 py-1">
              <input
                className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-md sm:leading-6"
                placeholder="john.doe@example.com"
                {...props.register('email', {
                  required: {
                    value: true,
                    message: 'Email is required',
                  },
                  validate: (value) => {
                    const emailRegex =
                      /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
                    if (!emailRegex.test(value)) {
                      return 'Invalid email address'
                    }
                    return true
                  },
                })}
              />
            </div>
            <div
              className={clsx(
                'mt-2 flex items-center',
                properties.data?.disabledAnonymousTelemetry && 'hidden'
              )}
            >
              <input
                {...props.register('shareEmail')}
                id="shareEmail"
                tabIndex={-1}
                type="checkbox"
                className="h-4 w-4 text-primary-600 transition duration-150 ease-in-out outline-0 ring-0 focus:ring-0 rounded-sm"
              />
              <span className="ml-2 text-sm text-gray-500 hover:cursor-pointer">
                <label htmlFor="shareEmail">
                  {`I'm okay to share my email with the Briefer team. `}
                </label>
                <Tooltip
                  title="We will NOT send you spam, we promise."
                  message="We use this field to understand who our users are and how we can improve Briefer."
                  position="top"
                  active
                  className="inline-block"
                  tooltipClassname="w-64"
                >
                  <span className="underline cursor-help hover:text-gray-600 flex gap-x-1.5 items-center">
                    {'That will help us a lot!'}
                  </span>
                </Tooltip>
              </span>
            </div>
            <FormError msg={props.formErrors.email?.message} />
          </div>
        </div>
        <div className="w-full">
          <label className="block text-md font-medium leading-6 text-gray-900">
            Password
          </label>
          <div className="pt-2">
            <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus:ring focus:ring-primary-200 px-2 py-1">
              <input
                type="password"
                className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-md sm:leading-6"
                placeholder="********"
                {...props.register('password', {
                  required: {
                    value: true,
                    message: 'Password is required',
                  },
                  validate: (value) => {
                    if (value.length < 6) {
                      return 'Password is too short'
                    }
                    return true
                  },
                })}
              />
            </div>
            <FormError msg={props.formErrors.password?.message} />
          </div>
        </div>

        <div className="w-full">
          <label className="block text-md font-medium leading-6 text-gray-900">
            Confirm password
          </label>
          <div className="pt-2">
            <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus:ring focus:ring-primary-200 px-2 py-1">
              <input
                type="password"
                className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-md sm:leading-6"
                placeholder="********"
                {...props.register('confirmPassword', {
                  required: {
                    value: true,
                    message: 'Confirm password is required',
                  },
                  validate: (value) => {
                    if (value !== props.getValues().password) {
                      return 'Passwords do not match'
                    }
                    return true
                  },
                })}
              />
            </div>
            <FormError msg={props.formErrors.confirmPassword?.message} />
          </div>
        </div>

        <div
          className={clsx(
            'w-full',
            properties.data?.disabledAnonymousTelemetry && 'hidden'
          )}
        >
          <label className="block text-md font-medium leading-6 text-gray-900">
            How did you hear about us?
          </label>
          <div className="pt-2">
            <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus:ring focus:ring-primary-200 px-2 py-1">
              <input
                type="text"
                className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-md sm:leading-6"
                placeholder="Twitter, LinkedIn, HackerNews, content creator, etc..."
                {...props.register('source', {
                  required: {
                    value: !(
                      properties.data?.disabledAnonymousTelemetry ?? false
                    ),
                    message: "We'd love to know how you found us",
                  },
                })}
              />
            </div>
            <FormError msg={props.formErrors.source?.message} />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="flex items-center justify-center gap-x-2 py-2 px-4 bg-primary-200 disabled:bg-gray-400 rounded-sm hover:bg-primary-300 disabled:hover:bg-gray-400 shadow-sm"
        disabled={props.isSubmitting}
      >
        <span>Finish</span>
        {props.isSubmitting ? <Spin /> : <ArrowRightIcon className="h-4 w-4" />}
      </button>
    </form>
  )
}

export default UserSetupForm
