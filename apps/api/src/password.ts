import bcrypt from 'bcrypt'

export function isValidPassword(password: string) {
  return password.length >= 6
}

export function comparePassword({
  encrypted,
  password,
}: {
  encrypted: string
  password: string
}): Promise<boolean> {
  return bcrypt.compare(password, encrypted)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export function generatePassword(size: number) {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'

  let result = ''
  const charactersLength = characters.length
  for (let i = 0; i < size; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }

  return result
}
