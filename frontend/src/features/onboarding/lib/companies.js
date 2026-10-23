// Placeholder until there's a company API. Used by both Employer steps.
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
