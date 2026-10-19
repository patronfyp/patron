import { describe, expect, it } from 'vitest'

import { API_BASE_URL } from '@/config/env'

import { fileUrl } from './fileUrl'

describe('fileUrl', () => {
  it('puts the API base in front of a path the API returned', () => {
    expect(fileUrl('/api/v1/profile/abc/photo')).toBe(`${API_BASE_URL}/api/v1/profile/abc/photo`)
  })

  it('gives null when there is no file', () => {
    expect(fileUrl(null)).toBeNull()
    expect(fileUrl(undefined)).toBeNull()
    expect(fileUrl('')).toBeNull()
  })
})
