import { useState } from 'react'

import { App, Button, Flex, Form, Result, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'

import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import StepPlaceholder from '../components/StepPlaceholder'
import WizardShell from '../components/WizardShell'
import { useProfile, useUpdateProfile } from '../hooks/useProfile'
import { STEPS } from '../steps'

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

  const current = STEPS[step - 1]
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

    if (isLastStep) {
      save({ ...values, onboarding_step: step }, () => navigate('/', { replace: true }))
      return
    }
    save({ ...values, onboarding_step: step + 1 }, () => setStep(step + 1))
  }

  // Saves whatever is filled in, unvalidated - leaving half-way is the point.
  const handleSaveExit = () => {
    save({ ...form.getFieldsValue(), onboarding_step: step }, () =>
      navigate('/', { replace: true }),
    )
  }

  return (
    <WizardShell
      step={step}
      title={current.title}
      subtitle={current.subtitle}
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
        <StepPlaceholder />
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
