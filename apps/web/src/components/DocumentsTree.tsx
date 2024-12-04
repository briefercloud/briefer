import { ascend, sortWith } from 'ramda'
import { useDrag, useDrop, useDragLayer, XYCoord } from 'react-dnd'
import {
  EllipsisHorizontalIcon,
  TrashIcon,
  Square2StackIcon,
  BookmarkIcon,
  BookmarkSlashIcon,
} from '@heroicons/react/24/outline'
import type { ApiDocument, UserWorkspaceRole } from '@briefer/database'
import clsx from 'clsx'
import Link from 'next/link'
import IconSelector from './IconSelector'
import { Menu, Transition } from '@headlessui/react'
import ReactDOM from 'react-dom'
import {
  CSSProperties,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import useDropdownPosition from '@/hooks/dropdownPosition'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusSmallIcon,
} from '@heroicons/react/20/solid'
import { List, Stack } from 'immutable'
import { getEmptyImage } from 'react-dnd-html5-backend'

function getItemStyles(
  initialCursorOffset: XYCoord | null,
  initialOffset: XYCoord | null,
  currentOffset: XYCoord | null
) {
  if (!initialOffset || !currentOffset || !initialCursorOffset) {
    return {
      display: 'none',
    }
  }

  const x = initialCursorOffset?.x + (currentOffset.x - initialOffset.x)
  const y = initialCursorOffset?.y + (currentOffset.y - initialOffset.y)
  const transform = `translate(${x}px, ${y}px)`

  return {
    transform,
    WebkitTransform: transform,
  }
}

const layerStyles: CSSProperties = {
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 100,
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
}

const DocDragLayer = () => {
  const {
    item,
    isDragging,
    initialCursorOffset,
    initialFileOffset,
    currentFileOffset,
  } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    initialCursorOffset: monitor.getInitialClientOffset(),
    initialFileOffset: monitor.getInitialSourceClientOffset(),
    currentFileOffset: monitor.getSourceClientOffset(),
    isDragging: monitor.isDragging(),
  }))

  if (!isDragging) {
    return null
  }

  return (
    <div style={layerStyles}>
      <div
        style={getItemStyles(
          initialCursorOffset,
          initialFileOffset,
          currentFileOffset
        )}
      >
        <div className="p-1 bg-ceramic-200 rounded-md max-w-48 text-sm opacity-25 truncate flex gap-x-1 items-center py-2 -translate-x-1/2 -translate-y-1/2 scale-[.85] -rotate-6">
          <IconSelector
            workspaceId={item.workspaceId}
            documentId={item.id}
            disabled={true}
          />
          {item.title || 'Untitled'}
        </div>
      </div>
    </div>
  )
}

function useIsDocExpanded(doc: ApiDocument, startsOpen: boolean) {
  const [isExpanded, _setIsExpanded] = useState(
    localStorage.getItem(`briefer:document:${doc.id}:expanded`) === '1' ||
      startsOpen
  )

  const setIsExpanded = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      _setIsExpanded((prev) => {
        if (typeof value === 'function') {
          value = value(prev)
        }

        localStorage.setItem(
          `briefer:document:${doc.id}:expanded`,
          value ? '1' : '0'
        )

        return value
      })
    },
    [doc]
  )

  return [isExpanded, setIsExpanded] as const
}

type Node = {
  document: ApiDocument
  children: List<Node>
}

function buildTrees(
  parentId: string | null,
  data: List<ApiDocument>
): List<Node> {
  const children = data.filter((document) => document.parentId === parentId)

  const trees = children.map((root) => ({
    document: root,
    children: buildTrees(root.id, data),
  }))

  return List(
    sortWith(
      [
        ascend((t) => t.document.orderIndex),
        ascend((t) => t.document.createdAt),
      ],
      trees.toArray()
    )
  )
}

function isDescendant(
  childId: string,
  parentId: string,
  documents: List<ApiDocument>
): boolean {
  let currentId: string | null = childId
  while (currentId !== null) {
    const current = documents.find((doc) => doc.id === currentId)
    if (!current) {
      return false
    }

    if (current.id === parentId) {
      return true
    }

    currentId = current.parentId
  }

  return false
}

interface Props {
  workspaceId: string
  current: string
  documents: List<ApiDocument>
  role: UserWorkspaceRole
  onDuplicate: (id: string) => void
  onSetIcon: (id: string, icon: string) => void
  onFavorite: (id: string) => void
  onUnfavorite: (id: string) => void
  onDelete: (id: string) => void
  onCreate: (parentId: string) => void
  onUpdateParent: (
    id: string,
    parentId: string | null,
    orderIndex: number
  ) => void
  flat?: boolean
}
function DocumentTree(props: Props) {
  const trees = useMemo(
    () =>
      props.flat
        ? props.documents.map((d) => ({
            document: d,
            children: List<Node>(),
          }))
        : buildTrees(null, props.documents),
    [props.flat, props.documents]
  )

  return (
    <>
      <DocDragLayer />
      <ul role="list" className="space-y-1">
        {trees.map((node, i) => {
          const isLast = i === trees.size - 1
          return (
            <NodeComponent
              key={node.document.id}
              workspaceId={props.workspaceId}
              current={props.current}
              document={node.document}
              descendants={node.children}
              role={props.role}
              onDuplicate={props.onDuplicate}
              onSetIcon={props.onSetIcon}
              onFavorite={props.onFavorite}
              onUnfavorite={props.onUnfavorite}
              onDelete={props.onDelete}
              onCreate={props.onCreate}
              onUpdateParent={props.onUpdateParent}
              level={0}
              flat={props.flat}
              documents={props.documents}
              isLast={isLast}
              firstNonLastParentId={isLast ? null : node.document.id}
            />
          )
        })}
      </ul>
    </>
  )
}

function computeIsExpanded(current: string, isExpanded: boolean, node: Node) {
  if (current === node.document.id) {
    return isExpanded
  }

  if (isExpanded) {
    return true
  }

  let queue = Stack(node.children)
  let head = queue.first()
  queue = queue.shift()
  while (head) {
    if (head.document.id === current) {
      return true
    }

    queue = queue.push(...head.children.toArray())
    head = queue.first()
    queue = queue.shift()
  }

  return false
}

interface NodeComponentProps {
  workspaceId: string
  documents: List<ApiDocument>
  current: string
  document: ApiDocument
  descendants: List<Node>
  role: UserWorkspaceRole
  onDuplicate: (id: string) => void
  onSetIcon: (id: string, icon: string) => void
  onFavorite: (id: string) => void
  onUnfavorite: (id: string) => void
  onDelete: (id: string) => void
  onCreate: (id: string) => void
  onUpdateParent: (
    id: string,
    parentId: string | null,
    orderIndex: number
  ) => void
  level: number
  flat?: boolean
  isLast: boolean
  firstNonLastParentId: string | null
}
function NodeComponent(props: NodeComponentProps) {
  const [isExpanded, setIsExpanded] = useIsDocExpanded(
    props.document,
    computeIsExpanded(props.current, false, {
      document: props.document,
      children: props.descendants,
    })
  )
  useEffect(() => {
    setIsExpanded(
      computeIsExpanded(props.current, isExpanded, {
        document: props.document,
        children: props.descendants,
      })
    )
  }, [props.current, props.document, props.descendants])

  const toggleIsExpanded: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.preventDefault()
      setIsExpanded((v) => !v)
    },
    [setIsExpanded]
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const [, drag, dragPreview] = useDrag({
    type: 'document',
    item: props.document,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => !props.flat,
  })

  useEffect(() => {
    dragPreview(getEmptyImage(), { captureDraggingState: true })
  }, [])

  const [dropHoverState, setDropHoverState] = useState<
    'above' | 'below' | 'center'
  >('center')

  const [{ isDropping }, drop] = useDrop<
    ApiDocument,
    {},
    { isDropping: boolean }
  >(
    {
      accept: 'document',
      drop: (item, monitor) => {
        if (monitor.didDrop()) {
          return
        }

        const droppedOnDocument = props.document
        const droppedDocument = item

        // if dropped on document is a descendant of the document that was dropped we do nothing
        if (
          isDescendant(
            droppedOnDocument.id,
            droppedDocument.id,
            props.documents
          )
        ) {
          return
        }

        if (dropHoverState === 'center') {
          // when dropped center, we always make it a child
          props.onUpdateParent(item.id, droppedOnDocument.id, -1)
          return {}
        }

        if (dropHoverState === 'above') {
          // when dropped above we make it a sibling that comes before
          props.onUpdateParent(
            item.id,
            droppedOnDocument.parentId,
            droppedOnDocument.orderIndex
          )
          return {}
        }

        // when dropped below we make it a sibling that comes after
        props.onUpdateParent(
          item.id,
          droppedOnDocument.parentId,
          droppedOnDocument.orderIndex + 1
        )
        return {}
      },
      canDrop: (item) => !props.flat && item.id !== props.document.id,
      hover: (_item, monitor) => {
        if (!linkRef.current || !containerRef.current) {
          return
        }
        const clientOffset = monitor.getClientOffset()
        if (!clientOffset) {
          setDropHoverState('center')
          return
        }

        const componentRect =
          isExpanded && props.descendants.size === 0
            ? containerRef.current.getBoundingClientRect()
            : linkRef.current.getBoundingClientRect()
        const hoverClientY = clientOffset.y - componentRect.top

        // if 1/3 top set above else if 1/3 bottom set below else set center
        if (hoverClientY < componentRect.height / 3) {
          setDropHoverState('above')
        } else if (hoverClientY > (2 * componentRect.height) / 3) {
          setDropHoverState('below')
        } else {
          setDropHoverState('center')
        }
      },
      collect: (monitor) => ({
        isDropping:
          monitor.isOver({ shallow: true }) &&
          monitor.getItem().id !== props.document.id,
      }),
    },
    [
      props.document.id,
      props.onUpdateParent,
      setIsExpanded,
      linkRef,
      isExpanded,
      dropHoverState,
      props.documents,
      props.isLast,
      props.firstNonLastParentId,
    ]
  )

  return (
    <li
      className="relative"
      key={props.document.id}
      ref={(li) => {
        drop(li)
      }}
    >
      <div
        ref={(docDiv) => {
          drag(docDiv)
        }}
      >
        <div ref={containerRef}>
          {isDropping &&
            (dropHoverState === 'above' || dropHoverState === 'center') && (
              <div className="absolute top-0 left-0 w-full h-1 bg-ceramic-200" />
            )}
          {isDropping &&
            (dropHoverState === 'below' || dropHoverState === 'center') && (
              <div
                className="absolute left-0 w-full h-1 bg-ceramic-200"
                style={{
                  top: isExpanded
                    ? containerRef.current?.offsetHeight
                    : linkRef.current?.offsetHeight,
                }}
              />
            )}
          <Link
            href={`/workspaces/${props.workspaceId}/documents/${props.document.id}`}
            className={clsx(
              props.document.id === props.current
                ? 'text-gray-800 bg-ceramic-100/50'
                : 'text-gray-500 hover:bg-ceramic-100/80',
              isDropping &&
                dropHoverState === 'center' &&
                'bg-ceramic-200 border-ceramic-200',
              'group text-sm font-medium leading-6 w-full flex py-1 rounded-sm hover:text-ceramic-600'
            )}
            style={{
              paddingLeft: `${props.level}rem`,
            }}
            ref={linkRef}
          >
            <div className="w-full flex items-center justify-between pr-1.5 gap-x-1 pl-4">
              <div
                className={clsx('flex items-center', { 'pl-1': props.flat })}
              >
                {!props.flat && (
                  <button
                    className="hover:bg-ceramic-200 rounded-md p-0.5 flex items-center justify-center"
                    onClick={toggleIsExpanded}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
                <IconSelector
                  workspaceId={props.workspaceId}
                  documentId={props.document.id}
                  disabled={props.role === 'viewer'}
                />
              </div>
              <div className="flex items-center flex-1 overflow-auto">
                <span className="truncate">
                  {props.document.title || 'Untitled'}
                </span>
              </div>
              <DropDown
                documentId={props.document.id}
                isFavoriteDropdown={Boolean(props.flat)}
                onDelete={props.onDelete}
                onDuplicate={props.onDuplicate}
                onFavorite={props.onFavorite}
                onUnfavorite={props.onUnfavorite}
                role={props.role ?? 'viewer'}
                onCreate={props.onCreate}
              />
            </div>
          </Link>
          {isExpanded && (
            <ul
              role="list"
              className={clsx(
                isDropping &&
                  dropHoverState === 'center' &&
                  'bg-ceramic-200 border-ceramic-200',
                'space-y-1'
              )}
            >
              {props.descendants.size === 0 && (
                <li
                  className="text-gray-400 text-sm font-medium leading-6 py-1 rounded-sm pointer-events-none overflow-auto truncate"
                  style={{ paddingLeft: `${props.level + 3}rem` }}
                >
                  No documents inside
                </li>
              )}
              {props.descendants.map((node, i) => {
                const isLast = i === props.descendants.size - 1
                return (
                  <NodeComponent
                    key={node.document.id}
                    workspaceId={props.workspaceId}
                    current={props.current}
                    document={node.document}
                    descendants={node.children}
                    role={props.role}
                    onDuplicate={props.onDuplicate}
                    onSetIcon={props.onSetIcon}
                    onFavorite={props.onFavorite}
                    onUnfavorite={props.onUnfavorite}
                    onDelete={props.onDelete}
                    onCreate={props.onCreate}
                    onUpdateParent={props.onUpdateParent}
                    level={props.level + 1}
                    documents={props.documents}
                    isLast={isLast}
                    firstNonLastParentId={
                      isLast ? props.firstNonLastParentId : props.document.id
                    }
                  />
                )
              })}
            </ul>
          )}
        </div>
      </div>
      {props.isLast && props.level === 0 && <div className="h-10" />}
    </li>
  )
}

type DropDownProps = {
  documentId: string
  isFavoriteDropdown: boolean
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onFavorite: (id: string) => void
  onUnfavorite: (id: string) => void
  onCreate: (parentId: string) => void
  role: UserWorkspaceRole
}

function DropDown(props: DropDownProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const { onOpen, dropdownPosition } = useDropdownPosition(buttonRef)

  const onDeleteHandler: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.preventDefault()
      props.onDelete(props.documentId)
    },
    [props.onDelete, props.documentId]
  )

  const onDuplicateHandler: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      props.onDuplicate(props.documentId)
    }, [props.onDuplicate, props.documentId])

  const onFavoriteHandler: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      props.onFavorite(props.documentId)
    }, [props.onFavorite, props.documentId])

  const onUnfavoriteHandler: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      props.onUnfavorite(props.documentId)
    }, [props.onUnfavorite, props.documentId])

  const onCreateHandler: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.preventDefault()
      props.onCreate(props.documentId)
    },
    [props.onCreate, props.documentId]
  )

  return (
    <Menu as="div" className="relative inline-flex text-left">
      <Menu.Button
        className={clsx(
          (props.isFavoriteDropdown || props.role === 'viewer') && 'hidden',
          'pr-0.5'
        )}
        onClick={onCreateHandler}
      >
        <PlusSmallIcon className="invisible group-hover:visible hover:bg-ceramic-200/50 h-6 w-6 shrink-0 rounded-md" />
      </Menu.Button>
      <Menu.Button className="pr-0.5" ref={buttonRef} onClick={onOpen}>
        <EllipsisHorizontalIcon className="invisible group-hover:visible hover:bg-ceramic-200/50 h-6 w-6 shrink-0 rounded-md" />
      </Menu.Button>

      {ReactDOM.createPortal(
        <Transition
          as="div"
          id="doc-dropdown"
          style={{
            position: 'absolute',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
          }}
          className="absolute z-[2000]"
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute left-2 -top-6 z-20 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none translate-y-1/2">
            <div className="py-2 px-2">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onDeleteHandler}
                    className={clsx(
                      {
                        hidden:
                          props.role === 'viewer' || props.isFavoriteDropdown,
                      },
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                      'w-full px-4 py-2 text-left text-sm flex items-center gap-x-2 rounded-md'
                    )}
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onDuplicateHandler}
                    className={clsx(
                      {
                        hidden: props.role === 'viewer',
                      },
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                      'w-full px-4 py-2 text-left text-sm flex items-center gap-x-2'
                    )}
                  >
                    <Square2StackIcon className="h-4 w-4" />
                    <span>Duplicate</span>
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onFavoriteHandler}
                    className={clsx(
                      {
                        hidden: props.isFavoriteDropdown,
                      },
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                      'w-full px-4 py-2 text-left text-sm flex items-center gap-x-2'
                    )}
                  >
                    <BookmarkIcon className="h-4 w-4" />
                    <span>Add to favorites</span>
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onUnfavoriteHandler}
                    className={clsx(
                      {
                        hidden: !props.isFavoriteDropdown,
                      },
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                      'w-full px-4 py-2 text-left text-sm flex items-center gap-x-2'
                    )}
                  >
                    <BookmarkSlashIcon className="h-4 w-4" />
                    <span>Remove from favorites</span>
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>,
        document.body
      )}
    </Menu>
  )
}

export default DocumentTree
