import { Button, Flex, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'

import glowImage from '@/assets/brand/all-set-glow.svg'
import arrowRightIcon from '@/assets/icons/arrow-right.svg'
import briefcaseIcon from '@/assets/icons/briefcase.svg'
import building12Icon from '@/assets/icons/building-12.svg'
import buildingIcon from '@/assets/icons/building-18.svg'
import cap12Icon from '@/assets/icons/cap-12.svg'
import capIcon from '@/assets/icons/cap-18.svg'
import checkIcon from '@/assets/icons/check-40.svg'
import checkCircleIcon from '@/assets/icons/check-circle-18.svg'
import fileIcon from '@/assets/icons/file-18b.svg'
import mailIcon from '@/assets/icons/mail-18.svg'
import sendIcon from '@/assets/icons/send-18.svg'
import slidersIcon from '@/assets/icons/sliders-18.svg'
import { useAuthStore } from '@/features/auth'
import { useCompanyInvites, useMyCompany } from '@/features/companies'
import { useJobs } from '@/features/jobs'
import { useVerificationStatus } from '@/features/verification'
import Icon from '@/shared/components/Icon/Icon'

import { TrustBadge } from '../components/StepAside'
import WizardHeader from '../components/WizardHeader'
import { useProfile } from '../hooks/useProfile'
import { profileStrength } from '../lib/profileStrength'
import {
  isRecruiterOnly,
  isReferrerOnly,
  RECRUITER_STEPS,
  REFERRER_STEPS,
  STEPS,
  TEAM_MEMBER_COMPANY_ROLES,
  TEAM_MEMBER_STEPS,
} from '../lib/steps'

import styles from './AllSetPage.module.css'

const RING_RADIUS = 25.5 // a 56px ring with a 5px stroke (Figma 65:764)
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/** "Lahore University of Management Sciences (LUMS)" -> "LUMS". */
function shortName(university) {
  return university?.match(/\(([^)]+)\)/)?.[1] ?? university
}

/**
 * @param {object} props
 * @param {'success' | 'warning' | 'neutral'} props.tone
 */
function StatusChip({ tone, children }) {
  return (
    <span className={`${styles.chip} ${styles[tone]}`}>
      {tone === 'neutral' ? null : <span className={styles.dot} />}
      {children}
    </span>
  )
}

/**
 * @param {object} props
 * @param {string} props.icon
 * @param {'accent' | 'alum' | 'emp' | 'warning' | 'neutral'} props.tone - the icon tile's colour
 * @param {string} props.title
 * @param {string} props.detail
 * @param {import('react').ReactNode} props.badge
 */
function SummaryRow({ icon, tone, title, detail, badge }) {
  return (
    <li className={styles.row}>
      <span className={`${styles.tile} ${styles[`tile-${tone}`]}`}>
        <Icon src={icon} size={18} />
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowDetail}>{detail}</span>
      </span>
      {badge}
    </li>
  )
}

/** Each summary row, worked out from what the user really saved and verified. */
function summaryRows(profile, status) {
  const document = (kind) => status.documents.find((doc) => doc.kind === kind)

  const email = status.email_verified
    ? { tone: 'accent', badge: <StatusChip tone="success">Done</StatusChip> }
    : { tone: 'warning', badge: <StatusChip tone="warning">Not verified</StatusChip> }

  let university
  if (status.university_email) {
    university = {
      tone: 'alum',
      badge: (
        <TrustBadge tier="alum" icon={cap12Icon}>
          Verified alumni
        </TrustBadge>
      ),
    }
  } else if (document('university')?.status === 'pending') {
    university = { tone: 'warning', badge: <StatusChip tone="warning">In review</StatusChip> }
  } else {
    university = { tone: 'neutral', badge: <StatusChip tone="neutral">Not verified</StatusChip> }
  }

  let employer
  if (status.employer_email) {
    employer = {
      tone: 'emp',
      detail: `${profile.employer_name ?? 'Your employer'} · ${status.employer_email.email}`,
      badge: (
        <TrustBadge tier="emp" icon={building12Icon}>
          Verified employee
        </TrustBadge>
      ),
    }
  } else if (profile.employer_name) {
    employer = {
      tone: 'warning',
      detail: `${profile.employer_name} · work email not verified yet`,
      badge: <StatusChip tone="warning">Not verified</StatusChip>,
    }
  } else {
    employer = {
      tone: 'neutral',
      detail: 'Skipped for now',
      badge: <StatusChip tone="neutral">Skipped</StatusChip>,
    }
  }

  const skillCount = profile.skills.length
  const cvDone = Boolean(profile.cv) && skillCount > 0

  return [
    {
      key: 'email',
      icon: checkCircleIcon,
      title: status.email_verified ? 'Email verified' : 'Email',
      detail: status.email,
      ...email,
    },
    {
      key: 'university',
      icon: capIcon,
      title: profile.university ? `${shortName(profile.university)} alumni` : 'University',
      detail: profile.university
        ? [profile.degree, profile.graduation_year].filter(Boolean).join(' · ')
        : 'Not added yet',
      ...university,
    },
    { key: 'employer', icon: buildingIcon, title: 'Employer', ...employer },
    {
      key: 'cv',
      icon: fileIcon,
      title: 'CV and skills',
      detail: `${profile.cv ? 'CV uploaded' : 'No CV yet'} · ${skillCount} ${skillCount === 1 ? 'skill' : 'skills'}`,
      tone: cvDone ? 'accent' : 'neutral',
      badge: cvDone ? (
        <StatusChip tone="success">Done</StatusChip>
      ) : (
        <StatusChip tone="neutral">Missing</StatusChip>
      ),
    },
  ]
}

/** The referrer's summary rows (Figma 67:785), from what they really saved. */
function referrerRows(profile, status) {
  const letter = status.documents.find((doc) => doc.kind === 'employer')
  const where = profile.employer_name ?? 'your employer'
  const role = [profile.job_title, profile.team].filter(Boolean).join(' · ')

  let employer
  if (status.employer_email) {
    employer = {
      tone: 'emp',
      title: `Employee at ${where}`,
      badge: (
        <TrustBadge tier="emp" icon={building12Icon}>
          Employee Referral
        </TrustBadge>
      ),
    }
  } else if (letter?.status === 'pending') {
    employer = {
      tone: 'warning',
      title: `Employee at ${where}`,
      badge: <StatusChip tone="warning">In review</StatusChip>,
    }
  } else {
    employer = {
      tone: 'warning',
      title: 'Employer',
      badge: <StatusChip tone="warning">Not verified</StatusChip>,
    }
  }

  const limit = profile.monthly_referral_limit

  return [
    {
      key: 'email',
      icon: checkCircleIcon,
      title: status.email_verified ? 'Email verified' : 'Email',
      detail: status.email,
      tone: status.email_verified ? 'accent' : 'warning',
      badge: status.email_verified ? (
        <StatusChip tone="success">Done</StatusChip>
      ) : (
        <StatusChip tone="warning">Not verified</StatusChip>
      ),
    },
    { key: 'employer', icon: buildingIcon, detail: role || where, ...employer },
    {
      key: 'limit',
      icon: sendIcon,
      title: 'Referral limit',
      detail: limit ? `Up to ${limit} requests a month` : 'No monthly limit',
      tone: 'accent',
      badge: <StatusChip tone="success">Active</StatusChip>,
    },
  ]
}

/**
 * "You are ready to refer" (Figma 67:714). No made-up candidate count;
 * Review requests goes home until that page exists.
 */
function ReferrerAllSet({ profile, status, firstName }) {
  const navigate = useNavigate()
  const goHome = () => navigate('/', { replace: true })

  return (
    <div className={styles.screen}>
      <WizardHeader
        steps={REFERRER_STEPS}
        chip="Referrer"
        step={REFERRER_STEPS.length + 1}
        label="Setup complete"
        action={
          <Button type="text" size="small" className={styles.ghost} onClick={goHome}>
            Review requests
          </Button>
        }
      />

      <main className={`${styles.body} ${styles.bodyCentered}`}>
        <section className={styles.card}>
          <span className={styles.check}>
            <Icon src={checkIcon} size={40} />
          </span>

          <div className={styles.heading}>
            <h1 className={styles.title}>
              You are ready to refer{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className={styles.subtitle}>
              Verified candidates can now send you referral requests.
            </p>
          </div>

          <ul className={styles.rows}>
            {referrerRows(profile, status).map(({ key, ...row }) => (
              <SummaryRow key={key} {...row} />
            ))}
          </ul>

          <div className={styles.actions}>
            <Button size="large" className={styles.cta} onClick={() => navigate('/onboarding')}>
              <Icon src={slidersIcon} size={18} />
              Edit settings
            </Button>
            <Button type="primary" size="large" className={styles.cta} onClick={goHome}>
              Review requests
              <Icon src={arrowRightIcon} size={18} />
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}

/** The recruiter's summary rows (Figma 67:1242), from what they really saved. */
function recruiterRows(company, invites, jobs) {
  return [
    {
      key: 'company',
      icon: buildingIcon,
      title: 'Company verified',
      detail: company?.domain ?? 'Not set up yet',
      tone: company ? 'emp' : 'warning',
      badge: company ? (
        <TrustBadge tier="emp" icon={building12Icon}>
          Verified employer
        </TrustBadge>
      ) : (
        <StatusChip tone="warning">Not verified</StatusChip>
      ),
    },
    {
      key: 'team',
      icon: mailIcon,
      title: 'Team invited',
      detail: invites.length
        ? `${invites.length} ${invites.length === 1 ? 'person' : 'people'} invited`
        : 'No invites sent yet',
      tone: invites.length ? 'accent' : 'neutral',
      badge: invites.length ? (
        <StatusChip tone="success">Done</StatusChip>
      ) : (
        <StatusChip tone="neutral">Not yet</StatusChip>
      ),
    },
    {
      key: 'roles',
      icon: briefcaseIcon,
      title: 'Roles drafted',
      detail: jobs.length
        ? `${jobs.length} ${jobs.length === 1 ? 'role' : 'roles'} drafted`
        : 'No roles drafted yet',
      tone: jobs.length ? 'accent' : 'neutral',
      badge: jobs.length ? (
        <StatusChip tone="success">Done</StatusChip>
      ) : (
        <StatusChip tone="neutral">Not yet</StatusChip>
      ),
    },
  ]
}

/**
 * "You are ready to hire" (Figma 67:1242). Post first job and Open dashboard
 * both go home for now - there's no dedicated jobs page yet.
 */
function RecruiterAllSet({ company, invites, jobs, firstName }) {
  const navigate = useNavigate()
  const goHome = () => navigate('/', { replace: true })

  return (
    <div className={styles.screen}>
      <WizardHeader
        steps={RECRUITER_STEPS}
        chip="Recruiter"
        step={RECRUITER_STEPS.length + 1}
        label="Setup complete"
        action={
          <Button type="text" size="small" className={styles.ghost} onClick={goHome}>
            Open dashboard
          </Button>
        }
      />

      <main className={`${styles.body} ${styles.bodyCentered}`}>
        <section className={styles.card}>
          <span className={styles.check}>
            <Icon src={checkIcon} size={40} />
          </span>

          <div className={styles.heading}>
            <h1 className={styles.title}>
              You are ready to hire{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className={styles.subtitle}>
              Referred candidates can now be matched against {company?.name ?? 'your company'}
              &rsquo;s open roles.
            </p>
          </div>

          <ul className={styles.rows}>
            {recruiterRows(company, invites, jobs).map(({ key, ...row }) => (
              <SummaryRow key={key} {...row} />
            ))}
          </ul>

          <div className={styles.actions}>
            <Button size="large" className={styles.cta} onClick={goHome}>
              Post first job
            </Button>
            <Button type="primary" size="large" className={styles.cta} onClick={goHome}>
              Open dashboard
              <Icon src={arrowRightIcon} size={18} />
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}

/**
 * An invited hiring manager or interviewer: no Figma frame covers this (their
 * company and roles are someone else's work, not theirs to summarise), so
 * this is a plain, undesigned landing rather than reusing the recruiter's
 * rows for data that isn't about them.
 */
function TeamMemberAllSet({ firstName }) {
  const navigate = useNavigate()
  const goHome = () => navigate('/', { replace: true })

  return (
    <div className={styles.screen}>
      <WizardHeader
        steps={TEAM_MEMBER_STEPS}
        chip="Recruiter"
        step={TEAM_MEMBER_STEPS.length + 1}
        label="Setup complete"
        action={
          <Button type="text" size="small" className={styles.ghost} onClick={goHome}>
            Open dashboard
          </Button>
        }
      />

      <main className={`${styles.body} ${styles.bodyCentered}`}>
        <section className={styles.card}>
          <span className={styles.check}>
            <Icon src={checkIcon} size={40} />
          </span>

          <div className={styles.heading}>
            <h1 className={styles.title}>
              You&rsquo;re all set{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className={styles.subtitle}>
              You can review your team&rsquo;s roles and candidates from the dashboard.
            </p>
          </div>

          <div className={styles.actions}>
            <Button type="primary" size="large" className={styles.cta} onClick={goHome}>
              Open dashboard
              <Icon src={arrowRightIcon} size={18} />
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}

/** "You're all set" - the end of onboarding (Figma 65:630, or 67:714 for a referrer). */
function AllSetPage() {
  const navigate = useNavigate()
  const fullName = useAuthStore((state) => state.user?.full_name)
  const roles = useAuthStore((state) => state.user?.roles)
  const { data: profile } = useProfile()
  const { data: status } = useVerificationStatus()
  const recruiterOnly = isRecruiterOnly(roles)
  const { data: company, isLoading: isCompanyLoading } = useMyCompany({ enabled: recruiterOnly })
  const { data: invites = [] } = useCompanyInvites({ enabled: recruiterOnly })
  const { data: jobs = [] } = useJobs({ enabled: recruiterOnly })

  if (!profile || !status || (recruiterOnly && isCompanyLoading)) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    )
  }

  const firstName = fullName?.trim().split(/\s+/)[0]

  if (isReferrerOnly(roles)) {
    return <ReferrerAllSet profile={profile} status={status} firstName={firstName} />
  }

  if (recruiterOnly) {
    // An invited hiring manager/interviewer gets the plain landing; someone
    // who built their own company gets the real summary (#107).
    if (TEAM_MEMBER_COMPANY_ROLES.includes(company?.my_role)) {
      return <TeamMemberAllSet firstName={firstName} />
    }
    return <RecruiterAllSet company={company} invites={invites} jobs={jobs} firstName={firstName} />
  }

  const strength = profileStrength(profile, status)
  const goToDashboard = () => navigate('/', { replace: true })

  let strengthHint = 'Your profile is complete.'
  if (strength.nextStep) {
    strengthHint = strength.isOneAway
      ? `${strength.nextStep} to reach 100% and rank higher in referrer searches.`
      : `${strength.nextStep} to raise it and rank higher in referrer searches.`
  }

  return (
    <div className={styles.screen}>
      <WizardHeader
        step={STEPS.length + 1}
        label="Setup complete"
        action={
          <Button type="text" size="small" className={styles.ghost} onClick={goToDashboard}>
            Go to dashboard
          </Button>
        }
      />

      <main className={styles.body}>
        <img className={styles.glow} src={glowImage} alt="" />
        <section className={styles.card}>
          <span className={styles.check}>
            <Icon src={checkIcon} size={40} />
          </span>

          <div className={styles.heading}>
            <h1 className={styles.title}>
              You&rsquo;re all set{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className={styles.subtitle}>
              {profile.open_to_referrers
                ? 'Your profile is live. Verified referrers can now find you.'
                : 'Your profile is live. You can let referrers find you any time from your settings.'}
            </p>
          </div>

          <ul className={styles.rows}>
            {summaryRows(profile, status).map(({ key, ...row }) => (
              <SummaryRow key={key} {...row} />
            ))}
          </ul>

          <div className={styles.strength}>
            <span className={styles.ring}>
              <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
                <circle className={styles.ringTrack} cx="28" cy="28" r={RING_RADIUS} />
                <circle
                  className={styles.ringProgress}
                  cx="28"
                  cy="28"
                  r={RING_RADIUS}
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={RING_LENGTH * (1 - strength.percent / 100)}
                />
              </svg>
              <span className={styles.ringLabel}>{strength.percent}%</span>
            </span>
            <span className={styles.strengthText}>
              <span className={styles.rowTitle}>Profile strength {strength.percent}%</span>
              <span className={styles.rowDetail}>{strengthHint}</span>
            </span>
          </div>

          <Button type="primary" size="large" block className={styles.cta} onClick={goToDashboard}>
            Go to dashboard
            <Icon src={arrowRightIcon} size={18} />
          </Button>
        </section>
      </main>
    </div>
  )
}

export default AllSetPage
