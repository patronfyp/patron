/**
 * The only file in the app allowed to read `import.meta.env`.
 * Everything else imports the named values from here.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error(
    'VITE_API_BASE_URL is not set. Copy frontend/.env.example to frontend/.env.local.',
  )
}
