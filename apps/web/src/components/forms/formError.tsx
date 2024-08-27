import clsx from 'clsx'

const FormError = ({ msg, isXs }: { msg?: string | null; isXs?: boolean }) => {
  return (
    <span
      className={clsx(
        isXs ? 'text-xs' : 'text-sm',
        `block text-sm text-red-800 empty:before:content-['\\200b'] pt-1 pb-1`
      )}
    >
      {msg}
    </span>
  )
}

export default FormError
