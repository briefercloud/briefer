import * as Y from 'yjs'
import { PGPubSub } from './pg.js'
import { logger } from '../../../logger.js'
import { PubSubProvider } from './index.js'

export async function testPubSubDoc() {
  let counter = 0
  const id = '12345'
  const doc = new Y.Doc()
  const content = doc.getText('content')

  const pgPubSub = new PGPubSub(`test-${id}`, logger())
  const pubSubProvider = new PubSubProvider(id, doc, 0, pgPubSub, logger())

  // read from stdin until a new line
  while (true) {
    console.log('Enter a command:')
    const command = await new Promise<string>((resolve) => {
      process.stdin.resume()
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim())
      })
    })

    switch (command) {
      case 'connect':
        await pubSubProvider.connect()
        break
      case '':
        break
      case 'exit':
        return
      case 'peers':
        console.log(JSON.stringify(Array.from(pubSubProvider.getSyncedPeers())))
        break
      case 'content':
        console.log(content.toString())
        break
      case 'write':
        console.log('writing', ++counter)
        content.insert(0, counter.toString())
        break
      default:
        logger().error(
          {
            command,
          },
          'Unknown command'
        )
    }
  }
}
