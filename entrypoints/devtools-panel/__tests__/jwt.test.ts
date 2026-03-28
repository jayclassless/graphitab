// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn((token: string, opts?: { header: boolean }) => {
    const parts = token.split('.')
    const segment = opts?.header ? parts[0] : parts[1]
    return JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')))
  }),
}))

import { isJwt, extractJwt, JWT_CLAIM_DESCRIPTIONS } from '../jwt'

// A real-looking JWT with {"alg":"HS256","typ":"JWT"}.{"sub":"1234","name":"Test"}.sig
const HEADER = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '')
const PAYLOAD = btoa(JSON.stringify({ sub: '1234', name: 'Test' })).replace(/=/g, '')
const VALID_JWT = `${HEADER}.${PAYLOAD}.dummysig`

describe('isJwt', () => {
  it('returns true for a valid JWT', () => {
    expect(isJwt(VALID_JWT)).toBe(true)
  })

  it('returns true for a Bearer-prefixed JWT', () => {
    expect(isJwt(`Bearer ${VALID_JWT}`)).toBe(true)
  })

  it('returns true for a lowercase bearer-prefixed JWT', () => {
    expect(isJwt(`bearer ${VALID_JWT}`)).toBe(true)
  })

  it('returns false for a plain string', () => {
    expect(isJwt('application/json')).toBe(false)
  })

  it('returns false for a two-part dotted string', () => {
    expect(isJwt('foo.bar')).toBe(false)
  })

  it('returns false for a three-part string without alg in header', () => {
    const noAlg = btoa(JSON.stringify({ typ: 'JWT' })).replace(/=/g, '')
    expect(isJwt(`${noAlg}.${PAYLOAD}.sig`)).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isJwt('')).toBe(false)
  })
})

describe('extractJwt', () => {
  it('strips the Bearer prefix', () => {
    expect(extractJwt(`Bearer ${VALID_JWT}`)).toBe(VALID_JWT)
  })

  it('returns the token unchanged if no prefix', () => {
    expect(extractJwt(VALID_JWT)).toBe(VALID_JWT)
  })

  it('strips any scheme prefix with a space', () => {
    expect(extractJwt(`token ${VALID_JWT}`)).toBe(VALID_JWT)
  })
})

describe('JWT_CLAIM_DESCRIPTIONS', () => {
  it('contains all RFC 7519 registered claims', () => {
    const rfc7519Claims = ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']
    for (const claim of rfc7519Claims) {
      expect(JWT_CLAIM_DESCRIPTIONS).toHaveProperty(claim)
      expect(typeof JWT_CLAIM_DESCRIPTIONS[claim]).toBe('string')
    }
  })

  it('contains common IANA-registered claims', () => {
    const ianaClaims = ['name', 'email', 'azp', 'scope', 'sid', 'nonce', 'auth_time', 'at_hash']
    for (const claim of ianaClaims) {
      expect(JWT_CLAIM_DESCRIPTIONS).toHaveProperty(claim)
    }
  })
})
