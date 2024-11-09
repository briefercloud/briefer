import * as Y from 'yjs'
import {
  YBlock,
  YBlockGroup,
  YRunAll,
  getRunAllAttributes,
  isRunAll,
} from '@briefer/editor'
import { IRunAllExecutor, RunAllExecutor } from '../executors_/run-all.js'
import { DataFrame } from '@briefer/types'
import PQueue from 'p-queue'
import { logger } from '../../../logger.js'
import { NotebookEvents } from '../../../events/index.js'

export interface IRunAllObserver {
  start(): void
  stop(): void
  isIdle(): boolean
}

export class RunAllObserver implements IRunAllObserver {
  private workspaceId: string
  private documentId: string
  private state: YRunAll
  private executor: IRunAllExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    state: YRunAll,
    executor: IRunAllExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.state = state
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public start() {
    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'starting run all observer'
    )

    this.handleInitialState()
    this.state.observe(this.onStateChange)

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'run all observer started'
    )
  }

  public stop() {
    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'stopping run all observer'
    )

    this.state.unobserve(this.onStateChange)

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'run all observer stopped'
    )
  }

  private handleInitialState() {
    const { status } = getRunAllAttributes(this.state)

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        status,
      },
      'handling initial run all state'
    )

    if (status !== 'idle') {
      this.state.setAttribute('status', 'idle')
    }
  }

  private onStateChange = (event: Y.YXmlEvent, tr: Y.Transaction) => {
    tr.doc.transact(() => {
      const el = event.target
      if (!(el instanceof Y.XmlElement) || !isRunAll(el)) {
        return
      }

      event.changes.keys.forEach(({ action }, key) => {
        if (action !== 'update') {
          logger().trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              action,
              key,
            },
            'ignoring run all block event'
          )
          return
        }

        if (key === 'status') {
          this.handleStatusChange(el, tr)
        }
      })
    }, tr.origin)
  }

  private async handleStatusChange(el: YRunAll, tr: Y.Transaction) {
    const { status } = getRunAllAttributes(el)

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        status,
      },
      'handling run all status change'
    )

    try {
      if (status === 'run-requested') {
        el.doc!.transact(() => {
          el.setAttribute('status', 'running')
          const total = this.executor.getTotal()
          el.setAttribute('total', total)
          el.setAttribute('remaining', total)
        })
      } else if (status === 'abort-requested') {
        el.setAttribute('status', 'aborting')
      } else if (status === 'aborting') {
        await this.executor.abort(tr)
        el.setAttribute('status', 'idle')
      } else if (status === 'running') {
        await this.executor.run(tr)
        el.doc!.transact(() => {
          el.setAttribute('status', 'idle')
          el.setAttribute('remaining', getRunAllAttributes(el).total)
        })
      }
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          status,
          err,
        },
        'Error while handling run all status change event'
      )

      el.setAttribute('status', 'idle')
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        status,
      },
      'finished handling run all status change'
    )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    state: YRunAll,
    blocks: Y.Map<YBlock>,
    layout: Y.Array<YBlockGroup>,
    dataframes: Y.Map<DataFrame>,
    executionQueue: PQueue,
    events: NotebookEvents
  ): RunAllObserver {
    const executor = RunAllExecutor.make(
      workspaceId,
      documentId,
      blocks,
      layout,
      state,
      dataframes,
      executionQueue,
      events
    )

    return new RunAllObserver(workspaceId, documentId, state, executor)
  }
}
