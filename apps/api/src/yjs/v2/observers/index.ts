import { logger } from '../../../logger.js'
import { BlocksObserver, IBlocksObserver } from './blocks/index.js'
import { IRunAllObserver, RunAllObserver } from './run-all.js'
import PQueue from 'p-queue'
import { WSSharedDocV2 } from '../index.js'
import { NotebookEvents } from '../../../events/index.js'

export class MainObserver {
  private readonly workspaceId: string
  private readonly documentId: string
  private readonly blocksObserver: IBlocksObserver
  private readonly runAllObserver: IRunAllObserver

  constructor(
    workspaceId: string,
    documentId: string,
    blocksObserver: IBlocksObserver,
    runAllObserver: IRunAllObserver
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.blocksObserver = blocksObserver
    this.runAllObserver = runAllObserver
  }

  public isIdle() {
    return this.blocksObserver.isIdle() // && this.runAllObserver.isIdle()
  }

  public start() {
    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'starting main observer'
    )

    this.blocksObserver.start()
    this.runAllObserver.start()

    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'main observer started'
    )
  }

  public stop() {
    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'stopping main observer'
    )

    this.blocksObserver.stop()
    this.runAllObserver.stop()

    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'main observer stopped'
    )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    doc: WSSharedDocV2,
    events: NotebookEvents
  ): MainObserver {
    const dataframes = doc.dataframes
    const blocks = doc.blocks
    const executionQueue = new PQueue({ concurrency: 1 })

    const blocksObserver = BlocksObserver.make(
      workspaceId,
      documentId,
      blocks,
      dataframes,
      executionQueue,
      events
    )

    const runAllObserver = RunAllObserver.make(
      workspaceId,
      documentId,
      doc.runAll,
      blocks,
      doc.layout,
      dataframes,
      executionQueue,
      events
    )

    return new MainObserver(
      workspaceId,
      documentId,
      blocksObserver,
      runAllObserver
    )
  }
}
