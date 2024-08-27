import { range } from 'ramda'

function DashboardSkeleton() {
  return (
    <div className="w-full px-8">
      {range(0, 4).map((r) => (
        <div key={r} className="flex w-full">
          {(() => {
            let c = 0
            let total = 5
            let children = []
            while (total > 0) {
              const size = Math.min(Math.floor(Math.random() * 3) + 1, total)
              total = total - size
              children.push(
                <div
                  key={`${r}-${c}`}
                  className="h-48 p-2"
                  style={{
                    flex: size,
                  }}
                >
                  <div className="w-full h-full bg-gray-100  animate-pulse-dark" />
                </div>
              )
              c++
            }

            return children
          })()}
        </div>
      ))}
    </div>
  )
}

export default DashboardSkeleton
