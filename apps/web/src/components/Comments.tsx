import { Transition } from '@headlessui/react'
import {
  ChangeEventHandler,
  useCallback,
  useState,
  useRef,
  useEffect,
  FormEvent,
} from 'react'
import { UserIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline'
import timeAgo from '@/utils/timeAgo'
import { useSession } from '@/hooks/useAuth'
import { useComments } from '@/hooks/useComments'

interface Props {
  workspaceId: string
  documentId: string
  visible: boolean
  onHide: () => void
}
export default function Comments(props: Props) {
  const session = useSession()
  const [comments, { createComment }] = useComments(props.documentId)
  const [content, setContent] = useState('')

  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [comments.length, props.visible])

  const onComment = useCallback(
    async (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault()
      createComment(props.workspaceId, props.documentId, content)
      setContent('')
    },
    [createComment, content, props.documentId]
  )

  const onChangeContent: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      setContent(e.target.value)
    },
    [setContent]
  )

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> =
    useCallback(
      (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          onComment()
        }
      },
      [onComment]
    )

  return (
    <Transition
      show={props.visible}
      as="div"
      className="top-0 right-0 h-full absolute z-30"
      enter="transition ease-in-out duration-300 transform"
      enterFrom="translate-x-full"
      enterTo="translate-x-0"
      leave="transition ease-in-out duration-300 transform"
      leaveFrom="translate-x-0"
      leaveTo="translate-x-full"
    >
      <button
        className="absolute z-10 top-7 transform rounded-full border border-gray-300 text-gray-400 bg-white hover:bg-gray-100 w-6 h-6 flex justify-center items-center left-0 -translate-x-1/2"
        onClick={props.onHide}
      >
        <ChevronDoubleRightIcon className="w-3 h-3" />
      </button>
      <div
        className="w-[324px] flex flex-col overflow-y-scroll border-l border-gray-200 h-full bg-white"
        ref={ref}
      >
        <h3 className="text-lg font-medium leading-6 text-gray-900 px-2 px-4 pt-6 xl:px-6">
          Comments
        </h3>
        <ul
          role="list"
          className="flex-1 space-y-6 pb-6 pt-4 px-2 px-4 pt-6 xl:px-6"
        >
          {comments.map((comment) => {
            return (
              <li key={comment.id} className="relative flex gap-x-4">
                <>
                  <div className="flex-auto rounded-md p-3 ring-1 ring-inset ring-gray-200">
                    <div className="flex justify-between gap-x-4">
                      <div className="flex gap-x-1 py-0.5 leading-5 text-gray-500">
                        {comment.user.picture ? (
                          <img
                            src={comment.user.picture}
                            alt=""
                            className="relative h-5 w-5 flex-none rounded-full bg-gray-50"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex items-center justify-center relative h-5 w-5 flex-none bg-gray-50 rounded-full">
                            <UserIcon className="h-4 w-4" />
                          </div>
                        )}
                        <span className="text-xs font-medium text-gray-900">
                          {comment.user.name}
                        </span>{' '}
                      </div>
                      <time
                        dateTime={new Date(comment.createdAt).toISOString()}
                        className="flex-none py-0.5 text-xs leading-5 text-gray-300"
                      >
                        {timeAgo(new Date(comment.createdAt))}
                      </time>
                    </div>
                    <p className="text-sm leading-6 text-gray-600 pt-2">
                      {comment.content}
                    </p>
                  </div>
                </>
              </li>
            )
          })}
        </ul>

        <form className="sticky bottom-0 bg-white" onSubmit={onComment}>
          <div className="border-t border-gray-200 px-2 px-4 xl:px-6">
            <div className="py-6 flex gap-x-3">
              {session.data?.picture ? (
                <img
                  src={session.data?.picture}
                  alt=""
                  className="h-6 w-6 flex-none rounded-full bg-gray-50"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-6 w-6 flex justify-center items-center bg-gray-50 rounded-full">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}

              <div className="relative flex-auto">
                <div className="rounded-lg pb-12 shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-ceramic-200/70">
                  <label htmlFor="comment" className="sr-only">
                    Add your comment
                  </label>
                  <textarea
                    rows={2}
                    name="comment"
                    id="comment"
                    className="block w-full resize-none border-0 bg-transparent py-1.5 text-gray-900 placeholder:text-gray-400 focus:ring-0 text-sm leading-6"
                    placeholder="Add your comment..."
                    value={content}
                    onKeyDown={onKeyDown}
                    onChange={onChangeContent}
                  />
                </div>

                <div className="absolute inset-x-0 bottom-0 flex justify-end py-2 pl-3 pr-2">
                  <button
                    type="submit"
                    className="gap-x-2 rounded-sm bg-primary-200 px-3 py-1 text-sm hover:bg-primary-300"
                  >
                    Comment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </Transition>
  )
}
