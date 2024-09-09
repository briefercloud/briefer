'use client'

import { useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon } from '@heroicons/react/24/outline'
import { KeyboardIcon } from 'lucide-react'
import clsx from 'clsx'

type ShortcutsModalProps = {
  visible: boolean
  onHide: () => void
}

const shortcuts: {
  keys: string[]
  action: string
  mode: 'insert' | 'command'
}[] = [
  {
    keys: ['Escape'],
    action: 'Unfocus block and enter command mode',
    mode: 'insert',
  },
  {
    keys: ['Enter'],
    action: 'Focus on block and enter insert mode',
    mode: 'command',
  },
  {
    keys: ['h', '←'],
    action: 'Move cursor left (select left tab)',
    mode: 'command',
  },
  { keys: ['j', '↓'], action: 'Move cursor down', mode: 'command' },
  { keys: ['k', '↑'], action: 'Move cursor up', mode: 'command' },
  {
    keys: ['l', '→'],
    action: 'Move cursor right (select right tab)',
    mode: 'command',
  },
  { keys: ['ap'], action: 'Add Python block above', mode: 'command' },
  { keys: ['aq'], action: 'Add Query block above', mode: 'command' },
  { keys: ['am'], action: 'Add Markdown/Text block above', mode: 'command' },
  { keys: ['bp'], action: 'Add Python block below', mode: 'command' },
  { keys: ['bq'], action: 'Add Query block below', mode: 'command' },
  { keys: ['bm'], action: 'Add Markdown/Text block below', mode: 'command' },
  { keys: ['dd'], action: 'Delete block', mode: 'command' },
  { keys: ['⌘ + Enter'], action: 'Run block', mode: 'insert' },
  { keys: ['⌘ + e'], action: 'Toggle "Edit with AI"', mode: 'insert' },
  {
    keys: ['Shift + Enter'],
    action: 'Run block and focus on next block',
    mode: 'insert',
  },
  {
    keys: ['Alt + Enter'],
    action: 'Run block and insert new block below',
    mode: 'insert',
  },
]

const KeyboardKey = (props: {
  children: string
  mode: 'insert' | 'command'
}) => (
  <span
    className={clsx(
      'px-1.5 py-0.5 rounded-md font-mono',
      props.mode === 'insert'
        ? 'bg-green-100 text-green-700'
        : 'bg-blue-100 text-blue-700'
    )}
  >
    {props.children}
  </span>
)

export default function ShortcutsModal(props: ShortcutsModalProps) {
  return (
    <Transition show={props.visible}>
      <Dialog onClose={props.onHide} className="relative z-[1000]">
        <Transition.Child
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-y-scroll rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 px-8 py-6 w-[532px] max-h-[90vh]">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <KeyboardIcon
                      aria-hidden="true"
                      className="h-6 w-6 text-green-600"
                    />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      Keyboard Shortcuts
                    </Dialog.Title>

                    <div className="mt-2 flex flex-col gap-y-2">
                      <p className="text-sm text-gray-500">
                        When in insert mode, blocks will be highlighted in{' '}
                        <span className="text-green-600">green</span>. When in
                        command mode, blocks will be highlighted in{' '}
                        <span className="text-blue-600">blue</span>. Shortcuts
                        here are highlighted accordingly.
                      </p>
                    </div>
                    <div className="mt-6 mb-8 text-sm flex flex-col gap-y-2">
                      {shortcuts.map((shortcut) => (
                        <div key={shortcut.action} className="flex gap-x-4">
                          <div className="flex items-center justify-end w-1/3 gap-x-2 whitespace-nowrap">
                            {shortcut.keys.map((key, i) => (
                              <>
                                <KeyboardKey key={i} mode={shortcut.mode}>
                                  {key}
                                </KeyboardKey>
                                {i < shortcut.keys.length - 1 && (
                                  <span className="text-gray-500">or</span>
                                )}
                              </>
                            ))}
                          </div>
                          <div className="text-gray-500 whitespace-nowrap ">
                            {shortcut.action}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    data-autofocus
                    onClick={props.onHide}
                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 mt-0 w-1/3"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
