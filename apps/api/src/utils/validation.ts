// accepts only alphanumeric characters, spaces and hyphens
const nameRegex = /^[a-zA-Z0-9\s-]+$/

export function isWorkspaceNameValid(name: string) {
  return nameRegex.test(name)
}

export function isUserNameValid(name: string) {
  return nameRegex.test(name)
}
