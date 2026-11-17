import { useEffect, useRef, useState } from 'react'

import { App, Button, Checkbox, Form, Input } from 'antd'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import lockIcon from '@/assets/icons/lock.svg'
import mailIcon from '@/assets/icons/mail.svg'
import userIcon from '@/assets/icons/user.svg'
import { INVITE_ROLES, useAcceptCompanyInvite, usePreviewCompanyInvite } from '@/features/companies'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'

import AuthLayout from '../components/AuthLayout'
import RoleCards from '../components/RoleCards'
import { useRegister } from '../hooks/useAuth'
import {
  getPasswordStrength,
  PASSWORD_STRENGTH_HINT,
  PASSWORD_STRENGTH_SEGMENTS,
} from '../lib/passwordStrength'
import { rememberPickedRole } from '../lib/roleMemory'

import styles from './RegisterPage.module.css'

const INVITE_ROLE_LABELS = Object.fromEntries(INVITE_ROLES.map((role) => [role.value, role.label]))

// A 422 from Pydantic carries an array of {msg}; our own errors carry a plain
// string - STANDARDS.md §4.7 says show the backend's reason, so handle both.
function getErrorMessage(error) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return 'Could not create your account. Please try again.'
}

// Figma node 64:185: a 4-segment bar plus a label that both track strength,
// and a static hint for what "strong" means.
function PasswordStrengthMeter({ password }) {
  const { score, label } = getPasswordStrength(password)
  if (!password) return null

  return (
    <div className={styles.strength}>
      <div className={styles.bars}>
        {Array.from({ length: PASSWORD_STRENGTH_SEGMENTS }, (_, index) => (
          <div key={index} className={`${styles.bar} ${index < score ? styles.barFilled : ''}`} />
        ))}
      </div>
      <div className={styles.strengthLabels}>
        <span className={score >= PASSWORD_STRENGTH_SEGMENTS ? styles.strengthStrong : undefined}>
          {label}
        </span>
        <span className={styles.strengthHint}>{PASSWORD_STRENGTH_HINT}</span>
      </div>
    </div>
  )
}

function RegisterPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { mutate, isPending } = useRegister()
  const [form] = Form.useForm()
  const password = Form.useWatch('password', form)
  // Outside the <Form>: Figma puts the role picker above the LinkedIn button,
  // and it always has a value (Candidate by default), so it needs no rules.
  const [role, setRole] = useState('candidate')

  // Remembered for SelectRolePage after a LinkedIn sign-up - the default too.
  useEffect(() => {
    rememberPickedRole(role)
  }, [role])

  // A team invite link (#105) carries its token as a query param rather than
  // a route segment, so following it doesn't need its own route.
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const [invite, setInvite] = useState(null)
  const previewInvite = usePreviewCompanyInvite()
  const acceptInvite = useAcceptCompanyInvite()
  // StrictMode double-invokes effects in development; a second preview call
  // with the same token is harmless, but would overwrite the email the user
  // may have already started editing.
  const hasPreviewedInvite = useRef(false)

  useEffect(() => {
    if (!inviteToken || hasPreviewedInvite.current) return
    hasPreviewedInvite.current = true

    previewInvite.mutate(inviteToken, {
      onSuccess: (preview) => {
        setInvite(preview)
        form.setFieldValue('email', preview.email)
      },
      // An unknown, expired or revoked token (#104) - the invite banner
      // just doesn't show; registering normally still works.
      onError: () => {},
    })
  }, [inviteToken, previewInvite, form])

  const onFinish = (values) => {
    mutate(
      {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        role,
      },
      {
        onSuccess: () => {
          message.success('Account created')
          if (!inviteToken) {
            navigate('/start', { replace: true })
            return
          }
          // The account exists and is signed in either way - a bad or
          // already-used invite token shouldn't block getting into the app.
          acceptInvite.mutate(inviteToken, {
            onSettled: () => navigate('/start', { replace: true }),
            onError: (error) =>
              message.error(
                getApiErrorMessage(
                  error,
                  "Could not join your team's company. You can try the invite link again.",
                ),
              ),
          })
        },
        onError: (error) => message.error(getErrorMessage(error)),
      },
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join PATRON and get referred by people who can vouch for you."
      quote="I signed up on a Monday. By Friday a LUMS alumnus at Garner had referred me."
      beforeLinkedIn={<RoleCards value={role} onChange={setRole} disabled={isPending} />}
      linkedInLabel="Sign up with LinkedIn"
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        disabled={isPending}
        autoComplete="off"
      >
        {invite ? (
          <p className={styles.inviteBanner}>
            <strong>{invite.company_name}</strong> invited you to join as{' '}
            {INVITE_ROLE_LABELS[invite.role] ?? invite.role}.
          </p>
        ) : null}

        <Form.Item
          name="fullName"
          label="Full name"
          rules={[{ required: true, message: 'Full name is required' }]}
        >
          <Input
            prefix={<Icon src={userIcon} className={styles.fieldIcon} />}
            placeholder="Jane Doe"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Email is required' },
            { type: 'email', message: 'Enter a valid email address' },
          ]}
        >
          <Input
            prefix={<Icon src={mailIcon} className={styles.fieldIcon} />}
            placeholder="jane@example.com"
            disabled={Boolean(invite)}
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          extra={<PasswordStrengthMeter password={password} />}
          rules={[
            { required: true, message: 'Password is required' },
            { min: 8, message: 'At least 8 characters' },
          ]}
        >
          <Input.Password
            prefix={<Icon src={lockIcon} className={styles.fieldIcon} />}
            placeholder="At least 8 characters"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm password"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator(_rule, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('Passwords do not match'))
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<Icon src={lockIcon} className={styles.fieldIcon} />}
            placeholder="Re-enter your password"
          />
        </Form.Item>

        <Form.Item
          name="termsAccepted"
          valuePropName="checked"
          rules={[
            {
              validator: (_rule, value) =>
                value
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error('You must agree to the Terms of Service and Privacy Policy'),
                    ),
            },
          ]}
        >
          <Checkbox className={styles.checkbox}>
            I agree to the Terms of Service and Privacy Policy
          </Checkbox>
        </Form.Item>

        <Button type="primary" htmlType="submit" size="large" loading={isPending} block>
          Create account
        </Button>
      </Form>
    </AuthLayout>
  )
}

export default RegisterPage
