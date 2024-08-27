import crypto from 'crypto'

export function encrypt(raw: string, hexKey: string): string {
  const binKey = Buffer.from(hexKey, 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-ctr', binKey, iv)

  const encrypted = Buffer.concat([cipher.update(raw), cipher.final()])

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encrypted: string, hexKey: string): string {
  const [iv, content] = encrypted.split(':')
  if (!iv || !content) {
    throw new Error('Invalid encrypted data')
  }

  const binKey = Buffer.from(hexKey, 'hex')
  const decipher = crypto.createDecipheriv(
    'aes-256-ctr',
    binKey,
    Buffer.from(iv, 'hex')
  )

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(content, 'hex')),
    decipher.final(),
  ])

  return decrypted.toString()
}
