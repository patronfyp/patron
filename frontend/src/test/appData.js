import { ok } from './fakeNetwork'

/** A signed-in candidate's profile, as GET /profile/me returns it. */
export const PROFILE = {
  headline: 'Full-Stack AI Engineer',
  bio: null,
  photo_url: null,
  linkedin_url: null,
  cv: null,
  skills: [],
  desired_roles: [],
  onboarding_step: 7,
  onboarding_completed: true,
}

/** GET /verification/me: email verified, university done, employer pending. */
export const STATUS = {
  email: 'abdul@example.com',
  email_verified: true,
  university_email: { email: 'abdul@lums.edu.pk', verified_at: '2026-11-01T10:00:00Z' },
  employer_email: null,
  documents: [{ id: 'd-1', kind: 'employer', filename: 'letter.pdf', status: 'pending' }],
}

/**
 * A fakeNetwork responder for the app shell and home page. Pass `data` to
 * change one answer, e.g. `{ connections: { items: [], total: 0 } }`.
 */
export function appResponder(data = {}) {
  const answers = {
    '/api/v1/profile/me': PROFILE,
    '/api/v1/verification/me': STATUS,
    '/api/v1/notifications/me/unread-count': { count: 3 },
    '/api/v1/notifications/me': { items: [], total: 0, limit: 5, offset: 0 },
    '/api/v1/connections': { items: [], total: 12 },
    '/api/v1/connections/requests': [],
    ...Object.fromEntries(
      Object.entries({
        profile: '/api/v1/profile/me',
        status: '/api/v1/verification/me',
        notifications: '/api/v1/notifications/me',
        connections: '/api/v1/connections',
        requests: '/api/v1/connections/requests',
      })
        .filter(([key]) => key in data)
        .map(([key, url]) => [url, data[key]]),
    ),
  }
  return (config) => ok(config, answers[config.url] ?? {})
}
