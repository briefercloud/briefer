import { ArrowRightIcon } from '@heroicons/react/24/outline'
import FormError from '@/components/forms/formError'
import {
  Control,
  FieldErrors,
  UseFormHandleSubmit,
  UseFormRegister,
} from 'react-hook-form'

export type WorkspaceStepFormValues = {
  workspaceName: string
}

interface Props {
  register: UseFormRegister<WorkspaceStepFormValues>
  control: Control<WorkspaceStepFormValues>
  formErrors: FieldErrors<WorkspaceStepFormValues>
  handleSubmit: UseFormHandleSubmit<WorkspaceStepFormValues, undefined>
  onNextStep: (values: WorkspaceStepFormValues) => void
}
function WorkspaceNameSetupStep(props: Props) {
  return (
    <form
      className="flex flex-col items-center justify-center py-48 gap-y-6"
      onSubmit={props.handleSubmit(props.onNextStep)}
    >
      <h2 className="text-2xl">{"What's your workspace name?"}</h2>
      <div className="relative flex flex-col items-start">
        <input
          type="text"
          id="search"
          className="block w-96 rounded-md border-0 py-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-300 sm:text-xl sm:leading-6"
          placeholder="My Company"
          {...props.register('workspaceName', {
            required: {
              value: true,
              message: 'The workspace name is required',
            },
          })}
        />
        <FormError msg={props.formErrors.workspaceName?.message} />
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

export default WorkspaceNameSetupStep
