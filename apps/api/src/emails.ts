export function obscureEmail(email: string): string {
  const [localPart, domain] = email.split('@')

  if (!localPart || !domain) {
    return email // Return the original email if it's not valid
  }

  // Calculate the number of characters to keep and to obscure
  const keepCharCount = Math.ceil(localPart.length * 0.4)
  const obscureCharCount = localPart.length - keepCharCount

  const obscuredLocalPart =
    localPart.substring(0, keepCharCount) + '*'.repeat(obscureCharCount)

  return `${obscuredLocalPart}@${domain}`
}
