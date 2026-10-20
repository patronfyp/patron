import { useState } from 'react'

import { App, Button, Card, Flex, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

import RoleCards from '../components/RoleCards'
import { useSetRole } from '../hooks/useAuth'
import { forgetPickedRole, getRememberedRole } from '../lib/roleMemory'

const { Title, Paragraph } = Typography

// A LinkedIn sign-up has no role yet; it picks one here before the app.
function SelectRolePage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  // Pre-selects the role picked on Create account, if any.
  const [role, setRole] = useState(() => getRememberedRole())
  const { mutate, isPending } = useSetRole()

  const handleContinue = () => {
    mutate(role, {
      onSuccess: () => {
        forgetPickedRole()
        navigate('/start', { replace: true })
      },
      onError: () => message.error('Could not save your role. Please try again.'),
    })
  }

  return (
    <Flex vertical align="center" justify="center" style={{ minHeight: '100%', padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 440 }}>
        <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
          One more thing
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 22 }}>
          How will you be using Patron? You can add more roles later.
        </Paragraph>

        <RoleCards value={role} onChange={setRole} disabled={isPending} />

        <Button
          type="primary"
          block
          size="large"
          style={{ marginTop: 22 }}
          disabled={!role}
          loading={isPending}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </Card>
    </Flex>
  )
}

export default SelectRolePage
