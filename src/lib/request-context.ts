import { AsyncLocalStorage } from 'node:async_hooks'

type Store = { userId: string }

const als = new AsyncLocalStorage<Store>()

export function enterWithUser(userId: string) {
  // Sets store for the current async execution chain.
  als.enterWith({ userId })
}

export function getUserId() {
  return als.getStore()?.userId ?? null
}
