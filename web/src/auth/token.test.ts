import { describe, expect, it } from 'vitest'
import { jwtWith, MemoryStorage } from '../test/memoryStorage'
import { isExpired, tokenEmail, tokenExpiry } from './token'
import { clearToken, getToken, setToken, TOKEN_KEY } from './tokenStore'

const NOW = new Date('2026-10-23T12:00:00Z')
const seconds = (date: Date) => Math.floor(date.getTime() / 1000)

describe('token claims', () => {
  it('reads exp and email', () => {
    const token = jwtWith({ exp: seconds(NOW), email: 'ada@example.com' })
    expect(tokenExpiry(token)).toEqual(NOW)
    expect(tokenEmail(token)).toBe('ada@example.com')
  })

  it('decodes non-ASCII claims', () => {
    const payload = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ email: 'zoë@example.com' }))))
    expect(tokenEmail(`h.${payload.replace(/=+$/, '')}.s`)).toBe('zoë@example.com')
  })

  it('is valid until shortly before exp', () => {
    expect(isExpired(jwtWith({ exp: seconds(NOW) + 3600 }), NOW)).toBe(false)
    expect(isExpired(jwtWith({ exp: seconds(NOW) + 10 }), NOW)).toBe(true) // inside the 30 s skew
    expect(isExpired(jwtWith({ exp: seconds(NOW) - 60 }), NOW)).toBe(true)
  })

  it('treats malformed or exp-less tokens as expired', () => {
    expect(isExpired('not-a-jwt', NOW)).toBe(true)
    expect(isExpired('a.%%%.c', NOW)).toBe(true)
    expect(isExpired(jwtWith({ sub: 'x' }), NOW)).toBe(true)
  })
})

describe('token store', () => {
  it('stores, returns and clears a valid token under devmeter.jwt', () => {
    const storage = new MemoryStorage()
    const token = jwtWith({ exp: seconds(NOW) + 3600 })
    setToken(token, storage)
    expect(storage.getItem(TOKEN_KEY)).toBe(token)
    expect(getToken(storage, NOW)).toBe(token)
    clearToken(storage)
    expect(getToken(storage, NOW)).toBeNull()
  })

  it('drops an expired token, so the user is signed out', () => {
    const storage = new MemoryStorage()
    setToken(jwtWith({ exp: seconds(NOW) - 60 }), storage)
    expect(getToken(storage, NOW)).toBeNull()
    expect(storage.getItem(TOKEN_KEY)).toBeNull()
  })
})
