const bannedUsers = ['dumpdumb77@gmail.com', 'leonid.danilchenko@jetbrains.com']

export const isBanned = (email: string) => bannedUsers.includes(email)
