import useResettableState from '@/hooks/useResettableState'
import clsx from 'clsx'
import { useEffect, useMemo } from 'react'

const possibleOffset = ['left-1/4', 'left-1/2', 'left-3/4']

const getRandomOffset = () => {
  const randomIndex = Math.floor(Math.random() * possibleOffset.length)
  return possibleOffset[randomIndex]
}

const LineSkeleton = () => {
  const offset = useMemo(() => getRandomOffset(), [])
  return (
    <div className="bg-gray-100 h-8 relative">
      <div className={`absolute ${offset} bg-white w-2 h-full`} />
    </div>
  )
}

const TIMEOUT_TO_SHOW = 200

interface Props {
  visible: boolean
}

export function TitleSkeleton(props: Props) {
  const [show, setShow] = useResettableState(false, [props.visible])
  useEffect(() => {
    if (!props.visible) {
      return
    }

    const timeout = setTimeout(() => {
      setShow(true)
    }, TIMEOUT_TO_SHOW)
    return () => {
      clearTimeout(timeout)
    }
  }, [props.visible, setShow])

  return (
    <div
      className={clsx(
        {
          hidden: !props.visible || !show,
        },
        'animate-pulse-dark w-full h-24 bg-gray-100 mb-4'
      )}
    />
  )
}

export function ContentSkeleton(props: Props) {
  const [show, setShow] = useResettableState(false, [props.visible])
  useEffect(() => {
    if (!props.visible) {
      return
    }

    const timeout = setTimeout(() => {
      setShow(true)
    }, TIMEOUT_TO_SHOW)
    return () => {
      clearTimeout(timeout)
    }
  }, [props.visible, setShow])

  // Generate 20 line skeletons
  const lines = useMemo(() => {
    const lines = []
    for (let i = 0; i < 20; i++) {
      lines.push(<LineSkeleton key={i} />)
    }
    return lines
  }, [])

  const type = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * 2)
    return randomIndex === 0 ? 'quote' : 'didYouKnow'
  }, [])

  const content = useMemo(() => {
    if (type === 'quote') {
      const randomIndex = Math.floor(Math.random() * quotes.length)
      return (
        <QuoteBlock
          quote={quotes[randomIndex].quote}
          author={quotes[randomIndex].author}
        />
      )
    } else {
      const randomIndex = Math.floor(Math.random() * didYouKnows.length)
      return <DidYouKnowBlock content={didYouKnows[randomIndex]} />
    }
  }, [type])

  return (
    <div
      className={clsx(
        {
          hidden: !props.visible || !show,
        },
        'flex items-center justify-center w-full h-full'
      )}
    >
      <div className="w-full h-full">
        <div className="relative">
          <div className="animate-pulse-dark flex flex-col space-y-2">
            {lines}
          </div>
          <div className="hidden absolute top-[40%] w-2/5 left-1/2 rounded-md bg-white shadow-lg border border-gray-300 p-4 -translate-y-full -translate-x-1/2">
            {content}
          </div>
        </div>
      </div>
    </div>
  )
}

const didYouKnows = [
  <>
    <p>You can add CSV files to your project by using the file upload block.</p>
    <p>
      Add one by typing <code>/upload</code> and pressing <code>Enter</code>.
    </p>
  </>,
  <>
    <p>
      You can invite other users to your workspace using the <code>Users</code>{' '}
      menu on the bottom left.
    </p>
  </>,
  <>
    <p>
      You can automatically rerun and update your document on a fixed schedule.
    </p>
    <p>
      For that, use the <code>Scheduled runs</code> button on the top right.
    </p>
  </>,
  <>
    <p>You can use your SQL query results as data frames in Python blocks.</p>
    <p>
      For that, use the name on the top right of the SQL block as a variable in
      your code.
    </p>
  </>,
]

type Quote = {
  quote: string
  author: string
}

const quotes: Quote[] = [
  {
    quote:
      'If we have data, let’s look at data. If all we have are opinions, let’s go with mine.',
    author: 'Jim Barksdale',
  },
  {
    quote: 'The plural of anecdote is not data.',
    author: 'Marc Bekoff',
  },
  {
    quote: 'It is a capital mistake to theorize before one has data.',
    author: `Sherlock Holmes`,
  },
  {
    quote: 'The best writing is rewriting.',
    author: 'E.B. White',
  },
  {
    quote: `A lot of problems can be debugged with "well, have you verified this personally?"`,
    author: 'Dalton Caldwell',
  },
]

type DidYouKnowProps = {
  content: React.ReactNode
}

const DidYouKnowBlock = ({ content }: DidYouKnowProps) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-2 text-center">
      <span className="text-[10px] font-bold text-hunter-500 uppercase">
        Did you know?
      </span>
      <div className="text-sm flex flex-col items-center space-y-4 text-neutral-600">
        {content}
      </div>
    </div>
  )
}

const QuoteBlock = ({ quote, author }: Quote) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-2">
      <div className="text-sm flex flex-col items-center space-y-4 text-neutral-600 text-center">
        <p>{quote}</p>
      </div>
      <span className="w-full text-[10px] font-bold text-hunter-500 uppercase text-right">
        — {author}
      </span>
    </div>
  )
}
