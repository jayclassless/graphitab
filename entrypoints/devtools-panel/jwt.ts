import { jwtDecode } from 'jwt-decode'

import claimDescriptions from './jwt-claims.json'

export const JWT_CLAIM_DESCRIPTIONS: Record<string, string> = claimDescriptions

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/

function stripScheme(value: string): string {
  const spaceIndex = value.indexOf(' ')
  return spaceIndex === -1 ? value : value.slice(spaceIndex + 1)
}

export function isJwt(value: string): boolean {
  const token = stripScheme(value)
  if (!JWT_PATTERN.test(token)) return false
  try {
    const header = jwtDecode(token, { header: true }) as Record<string, unknown>
    return 'alg' in header
  } catch {
    return false
  }
}

export function extractJwt(value: string): string {
  const spaceIndex = value.indexOf(' ')
  return spaceIndex === -1 ? value : value.slice(spaceIndex + 1)
}
