import { useMemo, useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp, Form } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Imported directly to mock it; app code uses the barrels.
// eslint-disable-next-line no-restricted-imports
import { updateCompany } from '@/features/companies/api/companies.api'
// eslint-disable-next-line no-restricted-imports
import { createJob } from '@/features/jobs/api/jobs.api'

import { StepControlsContext } from '../hooks/useStepControls'

import HiringStep from './HiringStep'

vi.mock('@/features/jobs/api/jobs.api', () => ({
  createJob: vi.fn(),
}))
vi.mock('@/features/companies/api/companies.api', () => ({
  updateCompany: vi.fn(),
}))

const GARNER = { id: 'c-1', name: 'Garner', domain: 'garner.com', hiring_timeline: 'this_month' }

const DRAFTED_JOB = {
  id: 'j-1',
  title: 'Software Engineer III',
  location: 'Lahore',
  work_mode: 'hybrid',
  salary_min: 450000,
  salary_max: 600000,
  openings: 2,
}

/** The wizard in miniature: a Form, and a Continue that runs the step's check. */
function Harness({ onResult, jobs = [], ...props }) {
  const [beforeContinue, setBeforeContinue] = useState(null)
  const controls = useMemo(() => ({ setBeforeContinue, setContinueLabel: () => {} }), [])
  return (
    <StepControlsContext.Provider value={controls}>
      <Form layout="vertical">
        <HiringStep company={GARNER} jobs={jobs} {...props} />
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

describe('HiringStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createJob.mockResolvedValue({ ...DRAFTED_JOB, id: 'j-new' })
    updateCompany.mockResolvedValue(GARNER)
  })

  it('shows an already-drafted job with its summary and openings chip', () => {
    renderStep({ jobs: [DRAFTED_JOB] })

    expect(screen.getByText('Software Engineer III')).toBeInTheDocument()
    expect(screen.getByText('Lahore · Hybrid · PKR 450k–600k')).toBeInTheDocument()
    expect(screen.getByText('2 openings')).toBeInTheDocument()
  })

  it('continues with everything untouched - nothing here is required', async () => {
    const onResult = renderStep()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(createJob).not.toHaveBeenCalled()
  })

  it('adds and removes a role row', async () => {
    const user = userEvent.setup()
    renderStep()

    expect(screen.getAllByRole('button', { name: /remove this role/i })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /add a role/i }))
    expect(screen.getAllByRole('button', { name: /remove this role/i })).toHaveLength(2)

    await user.click(screen.getAllByRole('button', { name: /remove this role/i })[0])
    expect(screen.getAllByRole('button', { name: /remove this role/i })).toHaveLength(1)
  })

  it('creates a filled-in role and saves the hiring timeline', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const onResult = renderStep()

    await user.type(screen.getByPlaceholderText('e.g. Software Engineer III'), 'Product Designer')
    await user.type(screen.getByPlaceholderText('Location'), 'Remote')
    await user.click(screen.getByText('This quarter'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(createJob.mock.calls[0][0]).toEqual({
      title: 'Product Designer',
      location: 'Remote',
      work_mode: 'on_site',
      openings: 1,
      salary_min: undefined,
      salary_max: undefined,
    })
    expect(updateCompany.mock.calls[0][0]).toEqual({ hiring_timeline: 'this_quarter' })
  })

  it('does not re-save a timeline that did not change', async () => {
    const onResult = renderStep()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(updateCompany).not.toHaveBeenCalled()
  })

  it('saves the timeline shown for a company that has none yet - never null', async () => {
    const onResult = renderStep({ company: { ...GARNER, hiring_timeline: null } })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    expect(updateCompany.mock.calls[0][0]).toEqual({ hiring_timeline: 'this_month' })
  })

  it('needs a location once a title is typed', async () => {
    const user = userEvent.setup()
    const onResult = renderStep()

    await user.type(screen.getByPlaceholderText('e.g. Software Engineer III'), 'Product Designer')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Add a location')).toBeInTheDocument()
    expect(onResult).toHaveBeenCalledWith(false)
    expect(createJob).not.toHaveBeenCalled()
  })

  it('refuses a maximum salary below the minimum', async () => {
    const user = userEvent.setup()
    const onResult = renderStep()

    await user.type(screen.getByPlaceholderText('e.g. Software Engineer III'), 'Product Designer')
    await user.type(screen.getByPlaceholderText('Location'), 'Lahore')
    await user.type(screen.getByPlaceholderText('Min PKR'), '500000')
    await user.type(screen.getByPlaceholderText('Max PKR'), '100000')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Max is below min')).toBeInTheDocument()
    expect(onResult).toHaveBeenCalledWith(false)
    expect(createJob).not.toHaveBeenCalled()
  })

  it('keeps only the role that failed, so Continue again does not create the others twice', async () => {
    const user = userEvent.setup()
    createJob
      .mockResolvedValueOnce({ ...DRAFTED_JOB, id: 'j-new' })
      .mockRejectedValueOnce({ response: { data: { detail: 'Something went wrong' } } })
    const onResult = renderStep()

    await user.type(screen.getByPlaceholderText('e.g. Software Engineer III'), 'First role')
    await user.type(screen.getByPlaceholderText('Location'), 'Lahore')
    await user.click(screen.getByRole('button', { name: /add a role/i }))
    await user.type(screen.getAllByPlaceholderText('e.g. Software Engineer III')[1], 'Second role')
    await user.type(screen.getAllByPlaceholderText('Location')[1], 'Karachi')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
    const titles = screen.getAllByPlaceholderText('e.g. Software Engineer III')
    expect(titles).toHaveLength(1)
    expect(titles[0]).toHaveValue('Second role')
  })
})
