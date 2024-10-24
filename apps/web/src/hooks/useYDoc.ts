import * as Y from 'yjs'
import { useEffect, useRef, useState } from 'react'
import useResettableState from './useResettableState'
import { getDocId, useProvider } from './useYProvider'
import {
  getLastUpdatedAt,
  getMetadata,
  isDirty,
  setDirty,
} from '@briefer/editor'
import { LRUCache } from 'lru-cache'
import Dexie, { EntityTable } from 'dexie'

const db = new Dexie('YjsDatabase') as Dexie & {
  yDocs: EntityTable<{ id: string; data: Uint8Array }, 'id'>
}

db.version(1).stores({
  yDocs: 'id, data',
})

function persistYDoc(id: string, yDoc: Y.Doc) {
  const data = Y.encodeStateAsUpdate(yDoc)
  db.yDocs.put({ id, data })
}

function restoreYDoc(id: string): [Y.Doc, Promise<void>] {
  const yDoc = new Y.Doc()

  const restore = db.yDocs
    .get(id)
    .then((item) => {
      if (item) {
        Y.applyUpdate(yDoc, item.data)
      }
    })
    .catch(async (e) => {
      console.error('Failed to restore Y.Doc', e)

      try {
        await db.yDocs.delete(id)
      } catch (e) {
        console.error('Failed to delete Y.Doc', e)
      }
    })

  return [yDoc, restore]
}

const cache = new LRUCache<string, Y.Doc>({
  max: 10,

  dispose: (yDoc) => {
    yDoc.destroy()
  },
})

type GetYDocResult = {
  id: string
  cached: boolean
  yDoc: Y.Doc
  restore: Promise<void>
}

function getYDoc(
  documentId: string,
  isDataApp: boolean,
  clock: number,
  publishedAt: string | null
): GetYDocResult {
  const id = getDocId(documentId, isDataApp, clock, publishedAt)
  let yDoc = cache.get(id)
  const cached = Boolean(yDoc)
  let restore = Promise.resolve()

  if (!yDoc) {
    const restoreResult = restoreYDoc(id)
    yDoc = restoreResult[0]
    restore = restoreResult[1]
    cache.set(id, yDoc)
  }

  return { id, cached, yDoc, restore }
}

export function useYDoc(
  documentId: string,
  isDataApp: boolean,
  clock: number,
  userId: string | null,
  publishedAt: string | null,
  connect: boolean,
  initialState: Buffer | null
) {
  const isFirst = useRef(true)
  const [{ id, cached, yDoc, restore }, setYDoc] = useState(() =>
    getYDoc(documentId, isDataApp, clock, publishedAt)
  )
  const [restoring, setRestoring] = useResettableState(() => true, [restore])
  useEffect(() => {
    restore.then(() => {
      setRestoring(false)
    })
  }, [restore])

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return () => {
        persistYDoc(id, yDoc)
      }
    }

    const next = getYDoc(documentId, isDataApp, clock, publishedAt)
    setYDoc(next)
    return () => {
      persistYDoc(next.id, next.yDoc)
    }
  }, [documentId, isDataApp, clock, publishedAt, userId])

  const metadata = useYDocState(yDoc, getMetadata)
  const provider = useProvider(
    yDoc,
    documentId,
    isDataApp,
    clock,
    userId,
    publishedAt
  )
  const [syncing, setSyncing] = useResettableState(() => true, [provider])
  useEffect(() => {
    const onSynced = (synced: boolean) => {
      setSyncing(!synced)
    }

    provider.onSynced(onSynced)

    return () => {
      provider.offSynced(onSynced)
    }
  }, [provider])

  useEffect(() => {
    if (initialState) {
      Y.applyUpdate(yDoc, initialState)
    }
  }, [initialState])

  useEffect(() => {
    if (connect) {
      provider.connect()
    }

    return () => {
      provider.destroy()
    }
  }, [provider, connect])

  useEffect(() => {
    if (syncing) {
      console.time(`${documentId} sync`)
      console.log(`${documentId} syncing`, new Date().toISOString())
      return
    }
    console.timeEnd(`${documentId} sync`)
    console.log(`${documentId} not syncing`, new Date().toISOString())

    const update = (
      _update: Uint8Array,
      _: any,
      yDoc: Y.Doc,
      tr: Y.Transaction
    ) => {
      if (syncing || !tr.local) {
        return
      }

      if (!isDirty(yDoc)) {
        setDirty(yDoc)
      }
    }

    yDoc.on('update', update)

    return () => {
      yDoc.off('update', update)
    }
  }, [yDoc, syncing])

  return {
    yDoc,
    provider,
    syncing: (syncing || restoring) && !cached,
    isDirty: metadata.state.value.getAttribute('isDirty') ?? false,
  }
}

export function useYDocState<T extends Y.AbstractType<any>>(
  yDoc: Y.Doc,
  getter: (doc: Y.Doc) => T
) {
  const [state, setState] = useResettableState<{ value: T }>(
    () => ({ value: getter(yDoc) }),
    [yDoc]
  )

  useEffect(() => {
    const onUpdate = () => {
      setState({ value: getter(yDoc) })
    }

    state.value.observeDeep(onUpdate)

    return () => {
      state.value.unobserveDeep(onUpdate)
    }
  }, [yDoc, state.value, getter])

  return { yDoc, state }
}

export function useLastUpdatedAt(yDoc: Y.Doc): string | null {
  const [lastUpdatedAt, setLastUpdatedAt] = useResettableState<string | null>(
    () => getLastUpdatedAt(yDoc),
    [yDoc]
  )

  useEffect(() => {
    const onUpdate = () => {
      setLastUpdatedAt(getLastUpdatedAt(yDoc))
    }
    yDoc.on('update', onUpdate)

    return () => {
      yDoc.off('update', onUpdate)
    }
  }, [yDoc])

  return lastUpdatedAt
}
