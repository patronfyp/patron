import { useMemo, useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp, Form } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Imported directly to mock it; app code uses the barrel.
// eslint-disable-next-line no-restricted-imports
import {
  createOrJoinCompany,
  updateCompany,
  uploadCompanyLogo,
} from '@/features/companies/api/companies.api'

import { StepControlsContext } from '../hooks/useStepControls'

import CompanyStep from './CompanyStep'

vi.mock('@/features/companies/api/companies.api', () => ({
  getMyCompany: vi.fn(),
  createOrJoinCompany: vi.fn(),
  updateCompany: vi.fn(),
  uploadCompanyLogo: vi.fn(),
  removeCompanyLogo: vi.fn(),
}))

const GARNER = {
  id: 'c-1',
  name: 'Garner',
  domain: 'garner.com',
  size: '1000+',
  industry: 'fintech',
  headquarters: 'Lahore, Pakistan',
  logo_url: null,
  employees_can_refer: true,
  verified_at: '2026-10-29T00:00:00Z',
  my_role: 'owner',
}

/** The wizard in miniature: a Form, and a Continue that runs the step's check. */
function Harness({ onResult, ...props }) {
  const [beforeContinue, setBeforeContinue] = useState(null)
  // Stable, as in OnboardingPage - a new object each render would loop.
  const controls = useMemo(() => ({ setBeforeContinue, setContinueLabel: () => {} }), [])
  return (
    <StepControlsContext.Provider value={controls}>
      <Form layout="vertical">
        <CompanyStep {...props} />
      </Form>
      <button type="button" onClick={async () => onResult(await beforeContinue?.())}>
        Continue
      </button>
    </StepControlsContext.Provider>
  )
}

function renderStep(props) {
  const onResult = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <Harness onResult={onResult} {...props} />
      </AntApp>
    </QueryClientProvider>,
  )
  return onResult
}

async function fillCompany(user) {
  await user.type(screen.getByLabelText('Company name'), 'Garner')
  await user.click(screen.getByText('1,000+'))
  await user.click(screen.getByLabelText('Industry'))
  await user.click(await screen.findByTitle('Fintech'))
  await user.click(screen.getByLabelText('Headquarters'))
  await user.click(await screen.findByTitle('Lahore, Pakistan'))
}

describe('CompanyStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createOrJoinCompany.mockResolvedValue(GARNER)
    updateCompany.mockResolvedValue(GARNER)
    uploadCompanyLogo.mockResolvedValue({ ...GARNER, logo_url: '/api/v1/companies/logos/x.png' })
  })

  it('fills the website from the verified work email', () => {
    renderStep({ company: null, verifiedEmail: 'ayesha@garner.com' })

    expect(screen.getByLabelText('Website')).toHaveValue('garner.com')
    expect(screen.getByText('Domain verified from ayesha@garner.com')).toBeInTheDocument()
  })

  it('creates the company on Continue', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onResult = renderStep({ company: null, verifiedEmail: 'ayesha@garner.com' })

    await fillCompany(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(createOrJoinCompany.mock.calls[0][0]).toEqual({
      name: 'Garner',
      website: 'garner.com',
      size: '1000+',
      industry: 'fintech',
      headquarters: 'Lahore, Pakistan',
    })
  })

  it('asks for a work email on the domain before it goes on', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    // Verified at a previous employer, setting up a different company.
    const onResult = renderStep({ company: null, verifiedEmail: 'ayesha@arbisoft.com' })

    await user.clear(screen.getByLabelText('Website'))
    await user.type(screen.getByLabelText('Website'), 'garner.com')
    expect(screen.getByLabelText('Work email at garner.com')).toBeInTheDocument()
    await fillCompany(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Verify an email at @garner.com')
    expect(onResult).toHaveBeenCalledWith(false)
    expect(createOrJoinCompany).not.toHaveBeenCalled()
  })

  it('stays on the step while fields are missing', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onResult = renderStep({ company: null, verifiedEmail: 'ayesha@garner.com' })

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Enter your company name')).toBeInTheDocument()
    expect(onResult).toHaveBeenCalledWith(false)
    expect(createOrJoinCompany).not.toHaveBeenCalled()
  })

  it('updates an existing company and keeps its website fixed', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onResult = renderStep({ company: GARNER, verifiedEmail: 'ayesha@garner.com' })

    expect(screen.getByLabelText('Website')).toBeDisabled()
    await user.click(screen.getByText('201–1,000'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(updateCompany.mock.calls[0][0]).toMatchObject({ name: 'Garner', size: '201-1000' })
    expect(createOrJoinCompany).not.toHaveBeenCalled()
  })

  it('uploads the picked logo once the company is saved', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onResult = renderStep({ company: GARNER, verifiedEmail: 'ayesha@garner.com' })
    const logo = new File(['png'], 'logo.png', { type: 'image/png' })
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:logo')
    globalThis.URL.revokeObjectURL = vi.fn()

    await user.upload(screen.getByLabelText('Company logo'), logo)
    expect(screen.getByRole('img', { name: 'Garner logo' })).toHaveAttribute('src', 'blob:logo')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(uploadCompanyLogo.mock.calls[0][0]).toBe(logo)
  })
})
