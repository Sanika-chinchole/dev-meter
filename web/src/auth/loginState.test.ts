import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../test/memoryStorage'
import { consumeLoginState, createLoginState, loginErrorMessage, loginUrl, parseCallback } from './loginState'

describe('login state', () => {
  it('is random, URL-safe, and works exactly once', () => {
    const storage = new MemoryStorage()
    const state = createLoginState(storage)
    expect(state).toMatch(/^[\w-]{43}$/)
    expect(createLoginState(new MemoryStorage())).not.toBe(state)

    expect(consumeLoginState(state, storage)).toBe(true)
    expect(consumeLoginState(state, storage)).toBe(false) // replay
  })

  it('rejects a wrong, missing, or never-started state', () => {
    const storage = new MemoryStorage()
    createLoginState(storage)
    expect(consumeLoginState('attacker-state', storage)).toBe(false)
    expect(consumeLoginState(undefined, new MemoryStorage())).toBe(false)
    expect(consumeLoginState('anything', new MemoryStorage())).toBe(false)
  })

  it('a wrong guess also burns the real state', () => {
    const storage = new MemoryStorage()
    const state = createLoginState(storage)
    consumeLoginState('attacker-state', storage)
    expect(consumeLoginState(state, storage)).toBe(false)
  })
})

describe('login URL and callback', () => {
  it('sends the backend a local callback carrying the state in the path', () => {
    expect(loginUrl('http://localhost:8080', 'http://localhost:5173', 'abc-123')).toBe(
      'http://localhost:8080/auth/login?redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fcallback%2Fabc-123')
  })

  it('reads ?token= or ?error= the way the backend sends them', () => {
    expect(parseCallback('?token=eyJ.abc.def')).toEqual({ kind: 'token', token: 'eyJ.abc.def' })
    expect(parseCallback('?error=access_denied')).toEqual({ kind: 'error', code: 'access_denied' })
    expect(parseCallback('')).toEqual({ kind: 'missing' })
    expect(parseCallback('?token=')).toEqual({ kind: 'missing' })
  })

  it('has friendly messages, with a generic one for unknown codes', () => {
    expect(loginErrorMessage('access_denied')).toBe('Sign-in was cancelled.')
    expect(loginErrorMessage('email_not_verified')).toMatch(/isn't verified/)
    expect(loginErrorMessage('<script>')).toBe('Sign-in failed. Please try again.')
  })
})
