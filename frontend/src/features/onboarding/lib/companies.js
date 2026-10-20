// Placeholder data: there is no company lookup API yet, so the companies and
// their details below are fixed until the backend provides one. Used by both
// Employer steps (candidate 9:337, referrer 67:505).
export const COMPANIES = [
  { name: 'Garner', domain: 'garner.com', size: '400 employees' },
  { name: 'Systems Limited', domain: 'systemsltd.com', size: '5,000+ employees' },
  { name: 'Arbisoft', domain: 'arbisoft.com', size: '900 employees' },
  { name: '10Pearls', domain: '10pearls.com', size: '1,200 employees' },
  { name: 'NetSol Technologies', domain: 'netsoltech.com', size: '1,800 employees' },
  { name: 'Careem', domain: 'careem.com', size: '3,000 employees' },
  { name: 'Afiniti', domain: 'afiniti.com', size: '1,000 employees' },
  { name: 'Motive', domain: 'gomotive.com', size: '2,500 employees' },
]

export const COMPANY_OPTIONS = COMPANIES.map((company) => ({
  value: company.name,
  label: company.name,
}))

export function findCompany(name) {
  return COMPANIES.find((company) => company.name === name)
}
