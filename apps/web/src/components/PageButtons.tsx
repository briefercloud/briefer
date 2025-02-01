import clsx from 'clsx'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'

type PageButtonsProps = {
  currentPage: number
  totalPages: number
  prevPage: () => void
  nextPage: () => void
  setPage: (page: number) => void
  loading: boolean
  isPublic: boolean
}

const PageButtons: React.FC<PageButtonsProps> = ({
  currentPage,
  totalPages,
  prevPage,
  nextPage,
  loading,
  setPage,
  isPublic,
}) => {
  const secondButtonPage =
    currentPage === 0
      ? 1
      : currentPage === totalPages - 1
      ? totalPages - 2
      : currentPage + 1
  return (
    totalPages > 1 && (
      <div className="flex items-center justify-end left-0 bottom-0 w-full">
        <button
          onClick={prevPage}
          disabled={currentPage === 0 || loading}
          className={clsx(
            currentPage !== 0 && !loading && 'hover:text-gray-500',
            'print:hidden disabled:opacity-50 text-gray-400 h-full'
          )}
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <button
          className={clsx(
            currentPage === 0 ? 'bg-gray-100 text-gray-500' : 'text-gray-400 ',
            'px-1 rounded-sm h-full text-xs hover:text-gray-500'
          )}
          onClick={() => {
            setPage(0)
          }}
        >
          1
        </button>
        {totalPages > 2 && (
          <button
            className={clsx(
              currentPage > 0 && currentPage < totalPages - 1
                ? 'bg-gray-100 text-gray-500'
                : 'text-gray-400',
              'px-1 rounded-sm h-full text-xs hover:text-gray-500'
            )}
            onClick={() =>
              setPage(
                currentPage === 0
                  ? 1
                  : currentPage === totalPages - 1
                  ? totalPages - 2
                  : currentPage + 1
              )
            }
            disabled={secondButtonPage > 5 && isPublic}
          >
            {currentPage === 0
              ? 2
              : currentPage === totalPages - 1
              ? totalPages - 1
              : currentPage + 1}
          </button>
        )}
        <button
          className={clsx(
            currentPage === totalPages - 1
              ? 'bg-gray-100 text-gray-500'
              : 'text-gray-400',
            'px-1 text-gray-400 rounded-sm h-full text-xs hover:text-gray-500'
          )}
          onClick={() => setPage(totalPages - 1)}
          disabled={totalPages > 5 && isPublic}
        >
          {totalPages}
        </button>
        <button
          onClick={nextPage}
          disabled={
            currentPage === totalPages - 1 ||
            loading ||
            (currentPage === 5 && isPublic)
          }
          className={clsx(
            currentPage !== totalPages - 1 && !loading && 'hover:text-gray-500',
            'print:hidden disabled:opacity-50 text-gray-400 rounded-sm h-full'
          )}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    )
  )
}

export default PageButtons
