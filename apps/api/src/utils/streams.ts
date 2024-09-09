import { Readable } from 'stream'

export async function readToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    stream.on('data', (chunk) => {
      data += chunk.toString()
    })
    stream.on('end', () => {
      resolve(data)
    })
    stream.on('error', reject)
  })
}
