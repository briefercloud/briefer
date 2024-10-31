import { spawn } from 'child_process'

const isMultiInstance = process.env.MULTI_INSTANCE?.toLowerCase() === 'true'
const instances = isMultiInstance ? 2 : 1

for (let i = 1; i <= instances; i++) {
  const port = 8080 + i
  const nodemonProcess = spawn(
    'nodemon',
    [
      '--watch',
      'src',
      '--watch',
      '.env',
      '--watch',
      'package.json',
      '--ext',
      'ts',
      '--exec',
      `node --max-old-space-size=16384 --inspect=${
        port + 1000
      } --loader ts-node/esm ./src/index.ts | pino-pretty`,
    ],
    { env: { ...process.env, PORT: port }, shell: true, stdio: 'inherit' }
  )

  nodemonProcess.on('close', (code) => {
    console.log(`Nodemon instance ${i} exited with code ${code}`)
  })
}
