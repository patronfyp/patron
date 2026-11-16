// CompanySize and Industry in backend/app/modules/companies/models.py.
export const COMPANY_SIZES = [
  { value: '1-50', label: '1–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1,000' },
  { value: '1000+', label: '1,000+' },
]

export const INDUSTRIES = [
  { value: 'software', label: 'Software' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'telecom', label: 'Telecom' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'media', label: 'Media' },
  { value: 'other', label: 'Other' },
]

export const HEADQUARTERS = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
].map((city) => ({ value: `${city}, Pakistan`, label: `${city}, Pakistan` }))

/** "ayesha@eng.garner.com" -> "eng.garner.com"; null for anything else. */
export function emailDomain(email) {
  return email?.toLowerCase().split('@')[1] ?? null
}

/** True when `email` is on `domain` or one of its subdomains. */
export function isOnDomain(email, domain) {
  const host = emailDomain(email)
  return Boolean(host && domain && (host === domain || host.endsWith(`.${domain}`)))
}

/** A website as typed, as the backend stores it: "https://www.Garner.com/x" -> "garner.com". */
export function websiteDomain(website) {
  const host = (website ?? '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split('/')[0]
    .split(':')[0]
  return host.replace(/^www\./, '') || null
}
