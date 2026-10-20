import { App, Button, Card, Flex, Form, Input, Typography } from 'antd'
import { Link } from 'react-router-dom'

import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import { useChangePassword } from '../hooks/useAuth'

const { Title, Paragraph } = Typography

function ChangePasswordForm() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const { mutate, isPending } = useChangePassword()

  const onFinish = (values) => {
    mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          message.success('Your password has been changed.')
          form.resetFields()
        },
        // The backend's message already says what went wrong.
        onError: (error) =>
          message.error(
            getApiErrorMessage(error, 'Could not change your password. Please try again.'),
          ),
      },
    )
  }

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} disabled={isPending} autoComplete="off">
      <Form.Item
        name="currentPassword"
        label="Current password"
        rules={[{ required: true, message: 'Enter your current password' }]}
      >
        <Input.Password placeholder="Your current password" />
      </Form.Item>

      <Form.Item
        name="newPassword"
        label="New password"
        rules={[
          { required: true, message: 'Password is required' },
          { min: 8, message: 'At least 8 characters' },
        ]}
      >
        <Input.Password placeholder="At least 8 characters" />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="Confirm new password"
        dependencies={['newPassword']}
        rules={[
          { required: true, message: 'Please confirm your new password' },
          ({ getFieldValue }) => ({
            validator(_rule, value) {
              if (!value || getFieldValue('newPassword') === value) {
                return Promise.resolve()
              }
              return Promise.reject(new Error('Passwords do not match'))
            },
          }),
        ]}
      >
        <Input.Password placeholder="Re-enter your new password" />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={isPending} block>
        Change password
      </Button>
    </Form>
  )
}

function SettingsPage() {
  return (
    <Flex justify="center" style={{ padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 480 }}>
        <Link to="/">&larr; Back</Link>

        <Title level={3} style={{ marginTop: 16, marginBottom: 4 }}>
          Account settings
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 22 }}>
          Change the password you sign in with.
        </Paragraph>

        <ChangePasswordForm />
      </Card>
    </Flex>
  )
}

export default SettingsPage
