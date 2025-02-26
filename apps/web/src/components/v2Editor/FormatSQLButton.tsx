import { Menu } from '@headlessui/react'
import { CodeBracketIcon } from '@heroicons/react/20/solid'
import { useRef } from 'react'
import { TooltipV2 } from '../Tooltips'

interface Props {
  onFormat: () => void
  disabled: boolean
}

function FormatSQLButton(props: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <Menu as="div" className="inline-block">
      {({ open }) => {
        return (
          <>
            <TooltipV2<HTMLButtonElement>
              message="Format and structure your SQL code for better readability."
              referenceRef={buttonRef}
              active={!open}
            >
              {(ref) => (
                <Menu.Button
                  ref={ref}
                  className="rounded-sm border border-gray-200 h-6 min-w-6 flex items-center justify-center relative group hover:bg-gray-50"
                  onClick={props.onFormat}
                  disabled={props.disabled}
                >
                  <CodeBracketIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-500" />
                </Menu.Button>
              )}
            </TooltipV2>
          </>
        )
      }}
    </Menu>
  )
}

export default FormatSQLButton
