import { useEffect, useState } from 'react'

import { App, Button, Checkbox, Form, Input } from 'antd'
import { Link, useNavigate } from 'react-router-dom'

import lockIcon from '../../../assets/icons/lock.svg'
import mailIcon from '../../../assets/icons/mail.svg'
import userIcon from '../../../assets/icons/user.svg'
import AuthLayout from '../components/AuthLayout'
import RoleCards from '../components/RoleCards'
import { useRegister } from '../hooks/useAuth'
import {
  getPasswordStrength,
  PASSWORD_STRENGTH_HINT,
  PASSWORD_STRENGTH_SEGMENTS,
} from '../passwordStrength'
import { rememberPickedRole } from '../roleMemory'

import styles from './RegisterPage.module.css'

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

  // Remembered so SelectRolePage can pre-select it after a LinkedIn sign-up
  // (#75) - LinkedIn itself never tells us what the user picked here. Runs
  // for the default too, not just a change, in case "Sign up with LinkedIn"
  // is clicked without touching the cards.
  useEffect(() => {
    rememberPickedRole(role)
  }, [role])

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
          navigate('/start', { replace: true })
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
        <Form.Item
          name="fullName"
          label="Full name"
          rules={[{ required: true, message: 'Full name is required' }]}
        >
          <Input
            prefix={<img src={userIcon} width={16} height={16} alt="" />}
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
            prefix={<img src={mailIcon} width={16} height={16} alt="" />}
            placeholder="jane@example.com"
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
            prefix={<img src={lockIcon} width={16} height={16} alt="" />}
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
            prefix={<img src={lockIcon} width={16} height={16} alt="" />}
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
