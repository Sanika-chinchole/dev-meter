import { describe, expect, it } from 'vitest'
import { normalizeBackendUrl } from './config'

describe('normalizeBackendUrl', () => {
  it('defaults to the local backend', () => {
    expect(normalizeBackendUrl(undefined)).toBe('http://localhost:8080')
    expect(normalizeBackendUrl('  ')).toBe('http://localhost:8080')
  })

  it('trims whitespace and trailing slashes', () => {
    expect(normalizeBackendUrl(' https://api.devmeter.example/ ')).toBe('https://api.devmeter.example')
    expect(normalizeBackendUrl('http://localhost:8080//')).toBe('http://localhost:8080')
  })
})
