import GridLayout from 'react-grid-layout'
import * as Y from 'yjs'
import * as z from 'zod'

export const DashboardItem = z.object({
  id: z.string(),
  type: z.literal('DASHBOARD_ITEM'),
  blockId: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  minW: z.number().optional(),
  minH: z.number().optional(),
})
export type DashboardItem = z.infer<typeof DashboardItem>
export type YDashboardItem = Y.XmlElement<DashboardItem>

function makeYDashboardItem(item: Omit<DashboardItem, 'type'>): YDashboardItem {
  const yDashboardItem = new Y.XmlElement<DashboardItem>()

  const attrs: DashboardItem = {
    ...item,
    type: 'DASHBOARD_ITEM',
  }

  for (const [key, value] of Object.entries(attrs)) {
    yDashboardItem.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }

  return yDashboardItem
}

export function addDashboardItemToYDashboard(
  dashboard: Y.Map<YDashboardItem>,
  item: Omit<DashboardItem, 'type'>
) {
  dashboard.set(item.id, makeYDashboardItem(item))
}

export function yDashboardToGridLayout(
  dashboard: Y.Map<YDashboardItem>
): GridLayout.Layout[] {
  const layout: GridLayout.Layout[] = []

  const extract = () => {
    dashboard.forEach((item, id) => {
      const dashItem = DashboardItem.safeParse(item.getAttributes())
      if (!dashItem.success) {
        dashboard.delete(id)
        return
      }

      layout.push({
        i: dashItem.data.id,
        x: dashItem.data.x,
        y: dashItem.data.y,
        w: dashItem.data.w,
        h: dashItem.data.h,
        minW: dashItem.data.minW,
        minH: dashItem.data.minH,
      })
    })
  }

  if (dashboard.doc) {
    dashboard.doc.transact(extract)
  } else {
    extract()
  }

  return layout
}

export function dashboardItemsToGridLayout(
  dashboard: Record<string, DashboardItem>
): GridLayout.Layout[] {
  return Object.entries(dashboard).map(([id, item]) => ({
    i: id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
  }))
}

export function getDashboardItem(
  dashboard: Y.Map<YDashboardItem>,
  id: string
): DashboardItem | null {
  const yDashItem = dashboard.get(id)
  if (!yDashItem) {
    return null
  }

  const dashItem = DashboardItem.safeParse(yDashItem.getAttributes())
  if (!dashItem.success) {
    dashboard.delete(id)
    return null
  }

  return dashItem.data
}

export function updateYDashboardFromRecord(
  dashboard: Y.Map<YDashboardItem>,
  record: Record<string, DashboardItem>
) {
  const operation = () => {
    const entries = Object.entries(record)
    if (entries.length === 0) {
      dashboard.clear()
      return
    }

    const keysToRemove = new Set(Array.from(dashboard.keys()))
    entries.forEach(([id, item]) => {
      const yDashItem = dashboard.get(id)
      if (yDashItem) {
        keysToRemove.delete(id)
      }

      dashboard.set(id, makeYDashboardItem(item))
    })

    keysToRemove.forEach((key) => {
      dashboard.delete(key)
    })
  }

  if (dashboard.doc) {
    dashboard.doc.transact(operation)
  } else {
    operation()
  }
}

export function yDashboardToRecord(
  dashboard: Y.Map<YDashboardItem>
): Record<string, DashboardItem> {
  const map: Record<string, DashboardItem> = {}

  const operation = () => {
    dashboard.forEach((item, id) => {
      const dashItem = DashboardItem.safeParse(item.getAttributes())
      if (!dashItem.success) {
        dashboard.delete(id)
        return
      }

      map[id] = dashItem.data
    })
  }

  if (dashboard.doc) {
    dashboard.doc.transact(operation)
  } else {
    operation()
  }

  return map
}

export function mergeGridLayoutIntoYDashboard(
  dashboard: Y.Map<YDashboardItem>,
  layout: GridLayout.Layout[]
) {
  const operation = () => {
    const newDash: Record<string, DashboardItem> = {}
    layout.forEach((item) => {
      const dashItem = getDashboardItem(dashboard, item.i)
      if (dashItem) {
        newDash[item.i] = {
          ...dashItem,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: item.minW,
          minH: item.minH,
        }
      }
    })

    updateYDashboardFromRecord(dashboard, newDash)
  }

  if (dashboard.doc) {
    dashboard.doc.transact(operation)
  } else {
    operation()
  }
}

export function isBlockInDashboard(
  dashboard: Y.Map<YDashboardItem>,
  blockId: string
): boolean {
  for (const [id, item] of dashboard.entries()) {
    const dashItem = DashboardItem.safeParse(item.getAttributes())
    if (!dashItem.success) {
      dashboard.delete(id)
      continue
    }

    if (dashItem.data.blockId === blockId) {
      return true
    }
  }

  return false
}

export function removeBlocksFromDashboard(
  dashboard: Y.Map<YDashboardItem>,
  blockIds: string[]
) {
  for (const [id, dashItem] of dashboard.entries()) {
    const blockId = dashItem.getAttribute('blockId')
    if (blockId && blockIds.includes(blockId)) {
      dashboard.delete(id)
    }
  }
}
