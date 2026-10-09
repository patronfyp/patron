import { useState } from 'react'

import { App, Button, Flex, Form, Result, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '@/features/auth'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import EmployerStep from '../components/EmployerStep'
import StepAside from '../components/StepAside'
import StepPlaceholder from '../components/StepPlaceholder'
import UniversityStep from '../components/UniversityStep'
import WizardShell from '../components/WizardShell'
import { useProfile, useUpdateProfile } from '../hooks/useProfile'
import { STEPS } from '../steps'

// Steps that are built; every other step renders StepPlaceholder.
// `isCandidate` decides the Employer step: optional and skippable for a
// candidate, required for anyone who will refer (company / both).
const STEP_VIEWS = {
  university: {
    render: () => <UniversityStep />,
    aside: (
      <StepAside
        title="Why verify?"
        text="Verified alumni can refer you, and you can refer juniors from your own school. Unverified profiles cannot send alumni referrals."
        tag="Alumni Referral"
      />
    ),
  },
  employer: {
    render: ({ isCandidate }) => <EmployerStep isRequired={!isCandidate} />,
    canSkip: ({ isCandidate }) => isCandidate,
    aside: (
      <StepAside
        title="Employer Referral"
        text="Verified employees can refer candidates straight into their company's hiring pipeline."
        tag="Verified employee"
      />
    ),
  },
}

// The only fields PATCH /profile/me accepts - it rejects unknown ones, and the
// form also holds UI-only values (the verification method, the OTP).
const PROFILE_FIELDS = ['university', 'degree', 'graduation_year', 'employer_name']

// Only the fields on screen are in `values`; an emptied one is sent as null so
// clearing it in the form clears it on the profile too.
function pickProfileFields(values) {
  return Object.fromEntries(
    PROFILE_FIELDS.filter((field) => field in values).map((field) => [
      field,
      values[field] ?? null,
    ]),
  )
}

/**
 * @param {object} props
 * @param {import('../api/onboarding.api').Profile} props.profile
 */
function OnboardingWizard({ profile }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { mutate, isPending } = useUpdateProfile()
  // Resume where the user left off; after this, the wizard owns the position.
  const [step, setStep] = useState(profile.onboarding_step)

  const isCandidate = useAuthStore((state) => state.user?.role) === 'candidate'

  const current = STEPS[step - 1]
  const view = STEP_VIEWS[current.key]
  const stepContext = { isCandidate }
  const isLastStep = step === STEPS.length

  const save = (changes, onSuccess) =>
    mutate(changes, {
      onSuccess,
      onError: (error) =>
        message.error(getApiErrorMessage(error, 'Could not save your progress. Please try again.')),
    })

  const handleContinue = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // antd is already showing the field errors
    }

    const fields = pickProfileFields(values)
    if (isLastStep) {
      save({ ...fields, onboarding_step: step }, () => navigate('/', { replace: true }))
      return
    }
    save({ ...fields, onboarding_step: step + 1 }, () => setStep(step + 1))
  }

  // Saves whatever is filled in, unvalidated - leaving half-way is the point.
  const handleSaveExit = () => {
    save({ ...pickProfileFields(form.getFieldsValue()), onboarding_step: step }, () =>
      navigate('/', { replace: true }),
    )
  }

  // Moves on without validating or saving this step's fields.
  const handleSkip = () => save({ onboarding_step: step + 1 }, () => setStep(step + 1))

  return (
    <WizardShell
      step={step}
      title={current.title}
      subtitle={current.subtitle}
      aside={view?.aside}
      secondaryAction={
        view?.canSkip?.(stepContext) ? (
          <Button type="text" onClick={handleSkip} disabled={isPending}>
            Skip for now
          </Button>
        ) : null
      }
      continueLabel={isLastStep ? 'Finish' : 'Continue'}
      isSaving={isPending}
      onBack={() => setStep(step - 1)}
      onContinue={handleContinue}
      onSaveExit={handleSaveExit}
    >
      <Form
        form={form}
        layout="vertical"
        disabled={isPending}
        initialValues={{
          university: profile.university ?? undefined,
          degree: profile.degree ?? undefined,
          graduation_year: profile.graduation_year ?? undefined,
          employer_name: profile.employer_name ?? undefined,
        }}
      >
        {view ? view.render(stepContext) : <StepPlaceholder />}
      </Form>
    </WizardShell>
  )
}

function OnboardingPage() {
  const { data: profile, isPending, isError, refetch } = useProfile()

  if (isPending) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    )
  }

  if (isError) {
    return (
      <Result
        status="error"
        title="Could not load your onboarding"
        subTitle="Check your connection and try again."
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  return <OnboardingWizard profile={profile} />
}

export default OnboardingPage
