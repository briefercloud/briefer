import clsx from 'clsx'

export type Tab = 'general' | 'display' | 'x-axis' | 'y-axis' | 'labels'

const tabs: Tab[] = ['general', 'display', 'x-axis', 'y-axis', 'labels']

function tabToName(tab: Tab): string {
  switch (tab) {
    case 'general':
      return 'General'
    case 'display':
      return 'Display'
    case 'x-axis':
      return 'X-Axis'
    case 'y-axis':
      return 'Y-Axis'
    case 'labels':
      return 'Labels'
  }
}

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
}
export default function VisualizationSettingsTabsV2(props: Props) {
  return (
    <div className="w-full border-b border-gray-200 pt-5 sticky top-0 bg-white z-10">
      <nav className="-mb-px flex" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tabToName(tab)}
            className={clsx(
              tab === props.tab
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-600',
              'whitespace-nowrap border-b-2 py-1 px-2 text-xs font-medium '
            )}
            aria-current={tab === props.tab ? 'page' : undefined}
            onClick={() => props.onChange(tab)}
          >
            {tabToName(tab)}
          </button>
        ))}
      </nav>
    </div>
  )
}
