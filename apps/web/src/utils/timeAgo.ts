import { format } from 'date-fns'

export default function timeAgo(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) {
    return `${diff}s ago`
  } else if (diff < 60 * 60) {
    const minutes = Math.floor(diff / 60)
    return `${minutes}m ago`
  } else if (diff < 24 * 60 * 60) {
    const hours = Math.floor(diff / (60 * 60))
    return `${hours}h ago`
  } else if (diff < 7 * 24 * 60 * 60) {
    const days = Math.floor(diff / (24 * 60 * 60))
    return `${days}d ago`
  } else {
    return format(date, 'do MMM, yyyy')
  }
}
