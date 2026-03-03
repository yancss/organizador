import crypto from 'crypto'

export function newResetToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}
