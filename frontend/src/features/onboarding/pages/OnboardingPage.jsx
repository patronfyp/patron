import { useCallback, useMemo, useState } from 'react'

import { App, Button, ConfigProvider, Flex, Form, Result, Spin } from 'antd'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'

import building12Icon from '@/assets/icons/building-12.svg'
import building20Icon from '@/assets/icons/building-20.svg'
import cap12Icon from '@/assets/icons/cap-12.svg'
import cap20Icon from '@/assets/icons/cap-20.svg'
import check11Icon from '@/assets/icons/check-11.svg'
import lockIcon from '@/assets/icons/lock-20.svg'
import shieldIcon from '@/assets/icons/shield-20.svg'
import sparkleIcon from '@/assets/icons/sparkle-20.svg'
import targetIcon from '@/assets/icons/target-20.svg'
import userIcon from '@/assets/icons/user-20.svg'
import zapIcon from '@/assets/icons/zap.svg'
import { wizardTheme } from '@/config/theme'
import { useAuthStore } from '@/features/auth'
import { useVerificationStatus } from '@/features/verification'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import AccountStep from '../components/AccountStep'
import CvStep from '../components/CvStep'
import EmployerStep from '../components/EmployerStep'
import PreferencesStep from '../components/PreferencesStep'
import ProfileStep from '../components/ProfileStep'
import SkillsStep from '../components/SkillsStep'
import StepAside, { AsideChecklist, AsideChip, TrustBadge } from '../components/StepAside'
import UniversityStep from '../components/UniversityStep'
import WizardShell from '../components/WizardShell'
import { useCompleteOnboarding, useProfile, useUpdateProfile } from '../hooks/useProfile'
import { StepControlsContext } from '../hooks/useStepControls'
import { STEPS } from '../steps'
import { LINKEDIN_PATTERN, formatSalaryRange, parseSalaryRange } from '../validation'

// The plain fields PATCH /profile/me accepts - it rejects unknown ones, and the
// form also holds UI-only values (the verification method). `salary_range`
// and `available_from` need converting, so they are handled separately.
const PROFILE_FIELDS = [
  'headline',
  'city',
  'phone',
  'linkedin_url',
  'bio',
  'university',
  'degree',
  'graduation_year',
  'employer_name',
  'skills',
  'primary_role',
  'desired_roles',
  'work_mode',
  'preferred_locations',
  'open_to_referrers',
]

/** The saved profile as the form's starting values. */
function toFormValues(profile) {
  return {
    ...Object.fromEntries(PROFILE_FIELDS.map((field) => [field, profile[field] ?? undefined])),
    salary_range: formatSalaryRange(profile.salary_min, profile.salary_max),
    available_from: profile.available_from ? dayjs(profile.available_from) : undefined,
  }
}

// Only the fields on screen are in `values`; an emptied one is sent as null
// so clearing it in the form clears it on the profile too.
function toProfileChanges(values) {
  const changes = Object.fromEntries(
    PROFILE_FIELDS.filter((field) => field in values).map((field) => [
      field,
      values[field] === '' ? null : (values[field] ?? null),
    ]),
  )
  if ('salary_range' in values) Object.assign(changes, parseSalaryRange(values.salary_range))
  if ('available_from' in values) {
    changes.available_from = values.available_from?.format('YYYY-MM-01') ?? null
  }
  // Lists can't be null - an emptied one is sent as [].
  for (const field of ['skills', 'desired_roles', 'preferred_locations']) {
    if (field in changes && changes[field] === null) changes[field] = []
  }
  if ('open_to_referrers' in changes && changes.open_to_referrers === null) {
    delete changes.open_to_referrers
  }
  return changes
}

/**
 * @param {object} props
 * @param {import('../api/onboarding.api').Profile} props.profile
 */
function OnboardingWizard({ profile }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const updateProfile = useUpdateProfile()
  const completeOnboarding = useCompleteOnboarding()
  const { data: status } = useVerificationStatus()
  // Resume where the user left off; after this, the wizard owns the position.
  const [step, setStep] = useState(profile.onboarding_step)
  const [useAccountEmailForUniversity, setUseAccountEmailForUniversity] = useState(true)
  const [beforeContinue, setBeforeContinue] = useState(null)
  const [stepContinueLabel, setStepContinueLabel] = useState(null)
  const [isCheckingStep, setIsCheckingStep] = useState(false)

  const email = useAuthStore((state) => state.user?.email)
  const isReferrer = useAuthStore((state) => state.user?.roles?.includes('referrer') ?? false)

  // Live values for the Profile step's checklist, which sits outside the form.
  const headline = Form.useWatch('headline', form)
  const linkedin = Form.useWatch('linkedin_url', form)

  const current = STEPS[step - 1]
  const isLastStep = step === STEPS.length
  const isSaving = updateProfile.isPending || completeOnboarding.isPending || isCheckingStep

  const stepControls = useMemo(
    () => ({ setBeforeContinue, setContinueLabel: setStepContinueLabel }),
    [],
  )

  const hasPendingDocument = (kind) =>
    status?.documents?.some((doc) => doc.kind === kind && doc.status === 'pending') ?? false

  const steps = {
    account: {
      render: () => (
        <AccountStep
          useForUniversity={useAccountEmailForUniversity}
          onUseForUniversityChange={setUseAccountEmailForUniversity}
        />
      ),
      aside: (
        <StepAside
          icon={shieldIcon}
          title="Why a code?"
          text="A verified email keeps fake profiles out. Referrers only see candidates who passed this step."
        >
          <AsideChip icon={zapIcon}>Takes 30 seconds</AsideChip>
        </StepAside>
      ),
    },
    profile: {
      render: () => <ProfileStep profile={profile} />,
      aside: (
        <StepAside
          icon={userIcon}
          title="What referrers see"
          text="Your headline and bio are the first thing a referrer reads before they decide to vouch for you."
        >
          <AsideChecklist
            checkIcon={check11Icon}
            items={[
              { label: 'Clear headline', done: Boolean(headline?.trim()) },
              { label: 'Real photo', done: Boolean(profile.photo_url) },
              { label: 'LinkedIn connected', done: LINKEDIN_PATTERN.test(linkedin ?? '') },
            ]}
          />
        </StepAside>
      ),
    },
    university: {
      render: () => (
        <UniversityStep
          defaultEmail={useAccountEmailForUniversity ? email : ''}
          verifiedEmail={status?.university_email?.email ?? null}
          hasPendingDocument={hasPendingDocument('university')}
        />
      ),
      aside: (
        <StepAside
          icon={cap20Icon}
          tone="alum"
          title="Why verify?"
          text="Verified alumni can refer you, and you can refer juniors later. Recruiters see a plum Alumni badge on your profile."
        >
          <TrustBadge tier="alum" icon={cap12Icon}>
            Verified Alumni
          </TrustBadge>
        </StepAside>
      ),
    },
    employer: {
      render: () => (
        <EmployerStep
          isRequired={isReferrer}
          verifiedEmail={status?.employer_email?.email ?? null}
        />
      ),
      // Required for anyone who refers (a verified employer is what lets them
      // refer), optional for everyone else.
      canSkip: !isReferrer,
      aside: (
        <StepAside
          icon={building20Icon}
          tone="emp"
          title="Employee Referral"
          text="Verified employees can refer candidates directly into their company's hiring pipeline."
        >
          <TrustBadge tier="emp" icon={building12Icon}>
            Verified Employee
          </TrustBadge>
        </StepAside>
      ),
    },
    cv: {
      render: () => <CvStep profile={profile} />,
      canSkip: true,
      aside: (
        <StepAside
          icon={lockIcon}
          title="Your CV stays private"
          text="Only referrers you send a request to can open it. Recruiters see it after a referral is accepted."
        />
      ),
    },
    skills: {
      render: () => <SkillsStep />,
      aside: (
        <StepAside
          icon={sparkleIcon}
          tone="ai"
          title="How we use skills"
          text="Skills power your match score. They are never shown to recruiters without a referral or your consent."
        />
      ),
    },
    preferences: {
      render: () => <PreferencesStep />,
      aside: (
        <StepAside
          icon={targetIcon}
          title="Better matches"
          text="PATRON uses these to rank jobs and suggest referrers who work where you want to be."
        />
      ),
    },
  }
  const view = steps[current.key]

  const save = useCallback(
    (changes, onSuccess) =>
      updateProfile.mutate(changes, {
        onSuccess,
        onError: (error) =>
          message.error(
            getApiErrorMessage(error, 'Could not save your progress. Please try again.'),
          ),
      }),
    [updateProfile, message],
  )

  const goTo = (nextStep) => {
    setStep(nextStep)
    window.scrollTo({ top: 0 })
  }

  const handleContinue = async () => {
    if (beforeContinue) {
      setIsCheckingStep(true)
      const canContinue = await beforeContinue().finally(() => setIsCheckingStep(false))
      if (!canContinue) return
    }

    let values
    try {
      values = await form.validateFields()
    } catch {
      return // antd is already showing the field errors
    }

    const changes = toProfileChanges(values)
    if (!isLastStep) {
      save({ ...changes, onboarding_step: step + 1 }, () => goTo(step + 1))
      return
    }
    save({ ...changes, onboarding_step: step }, () =>
      completeOnboarding.mutate(undefined, {
        onSuccess: () => navigate('/onboarding/done', { replace: true }),
        onError: (error) =>
          message.error(getApiErrorMessage(error, 'Could not finish setup. Please try again.')),
      }),
    )
  }

  // Saves whatever is filled in, unvalidated - leaving half-way is the point.
  const handleSaveExit = () => {
    save({ ...toProfileChanges(form.getFieldsValue()), onboarding_step: step }, () =>
      navigate('/', { replace: true }),
    )
  }

  // Moves on without validating or saving this step's fields.
  const handleSkip = () => save({ onboarding_step: step + 1 }, () => goTo(step + 1))

  return (
    <StepControlsContext.Provider value={stepControls}>
      <ConfigProvider theme={wizardTheme}>
        <WizardShell
          step={step}
          title={current.title}
          subtitle={current.subtitle}
          aside={view.aside}
          onSkip={view.canSkip ? handleSkip : undefined}
          continueLabel={stepContinueLabel ?? (isLastStep ? 'Finish setup' : 'Continue')}
          isSaving={isSaving}
          onBack={() => goTo(step - 1)}
          onContinue={handleContinue}
          onSaveExit={handleSaveExit}
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            disabled={isSaving}
            initialValues={toFormValues(profile)}
          >
            {/* Keyed by step so each step starts from a fresh mount - its
                own effects (the Account step's code send) run once. */}
            <div key={current.key}>{view.render()}</div>
          </Form>
        </WizardShell>
      </ConfigProvider>
    </StepControlsContext.Provider>
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
