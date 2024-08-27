import { icons } from 'lucide-react'

const allLucideIcons = Object.entries(icons).reduce(
  (acc, [key, value]) => {
    acc[`Lucide${key}`] = value
    return acc
  },
  {} as Record<string, React.ComponentType<React.ComponentProps<any>>>
)

export default allLucideIcons
