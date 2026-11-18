import { useMemo, useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp, Form } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Imported directly to mock it; app code uses the barrel.
// eslint-disable-next-line no-restricted-imports
import { createCompanyInvite, updateCompany } from '@/features/companies/api/companies.api'

import { StepControlsContext } from '../hooks/useStepControls'

import TeamStep from './TeamStep'

vi.mock('@/features/companies/api/companies.api', () => ({
  createCompanyInvite: vi.fn(),
  updateCompany: vi.fn(),
}))

const GARNER = {
  id: 'c-1',
  name: 'Garner',
  domain: 'garner.com',
  employees_can_refer: true,
}

const SENT_INVITE = {
  id: 'i-1',
  email: 'bilal.khan@garner.com',
  role: 'hiring_manager',
  status: 'pending',
}

const ACCEPTED_INVITE = {
  id: 'i-2',
  email: 'mehwish.ali@garner.com',
  role: 'interviewer',
  status: 'accepted',
}

/** The wizard in miniature: a Form, and a Continue that runs the step's check. */
function Harness({ onResult, invites = [], ...props }) {
  const [beforeContinue, setBeforeContinue] = useState(null)
  const controls = useMemo(() => ({ setBeforeContinue, setContinueLabel: () => {} }), [])
  return (
    <StepControlsContext.Provider value={controls}>
      <Form layout="vertical">
        <TeamStep company={GARNER} invites={invites} {...props} />
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

describe('TeamStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCompanyInvite.mockResolvedValue({ ...SENT_INVITE, id: 'i-new' })
    updateCompany.mockResolvedValue(GARNER)
  })

  it('shows a Sent chip for a pending invite and Accepted for one already joined', () => {
    renderStep({ invites: [SENT_INVITE, ACCEPTED_INVITE] })

    const pendingRow = screen.getByText('bilal.khan@garner.com').closest('div')
    expect(within(pendingRow).getByText('Hiring manager')).toBeInTheDocument()
    expect(within(pendingRow).getByText('Sent')).toBeInTheDocument()

    const acceptedRow = screen.getByText('mehwish.ali@garner.com').closest('div')
    expect(within(acceptedRow).getByText('Accepted')).toBeInTheDocument()
  })

  it('adds and removes draft rows', async () => {
    const user = userEvent.setup()
    renderStep()

    expect(screen.getAllByRole('button', { name: /remove this row/i })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /add another/i }))
    expect(screen.getAllByRole('button', { name: /remove this row/i })).toHaveLength(2)

    await user.click(screen.getAllByRole('button', { name: /remove this row/i })[0])
    expect(screen.getAllByRole('button', { name: /remove this row/i })).toHaveLength(1)
  })

  it('continues with everything untouched - nothing here is required', async () => {
    const onResult = renderStep()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(createCompanyInvite).not.toHaveBeenCalled()
  })

  it('sends a filled-in row, skipping an empty one, and saves the toggle', async () => {
    const user = userEvent.setup()
    const onResult = renderStep()

    await user.type(screen.getByPlaceholderText('name@garner.com'), 'new.hire@garner.com')
    await user.click(screen.getByRole('button', { name: /add another/i }))
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(createCompanyInvite.mock.calls).toHaveLength(1)
    expect(createCompanyInvite.mock.calls[0][0]).toEqual({
      email: 'new.hire@garner.com',
      role: 'hiring_manager',
    })
    expect(updateCompany.mock.calls[0][0]).toEqual({ employees_can_refer: false })
  })

  it('keeps only the invite that failed, so Continue again does not resend the others', async () => {
    const user = userEvent.setup()
    createCompanyInvite
      .mockResolvedValueOnce({ ...SENT_INVITE, id: 'i-new' })
      .mockRejectedValueOnce({ response: { data: { detail: 'Already on the team' } } })
    const onResult = renderStep()

    await user.type(screen.getByPlaceholderText('name@garner.com'), 'first@garner.com')
    await user.click(screen.getByRole('button', { name: /add another/i }))
    await user.type(screen.getAllByPlaceholderText('name@garner.com')[1], 'second@garner.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
    expect(await screen.findByText('Already on the team')).toBeInTheDocument()
    const drafts = screen.getAllByPlaceholderText('name@garner.com')
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toHaveValue('second@garner.com')
    expect(updateCompany).not.toHaveBeenCalled()
  })

  it('stays on the step for a badly formed email', async () => {
    const user = userEvent.setup()
    const onResult = renderStep()

    await user.type(screen.getByPlaceholderText('name@garner.com'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(onResult).toHaveBeenCalledWith(false)
    expect(createCompanyInvite).not.toHaveBeenCalled()
  })

  it('picks the role for a new invite', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onResult = renderStep()

    await user.type(screen.getByPlaceholderText('name@garner.com'), 'lead@garner.com')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByTitle('Recruiter'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(createCompanyInvite.mock.calls[0][0]).toEqual({
      email: 'lead@garner.com',
      role: 'recruiter',
    })
  })
})
