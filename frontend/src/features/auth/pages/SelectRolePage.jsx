import { useState } from 'react'

import { App, Button, Card, Flex, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

import RoleCards from '../components/RoleCards'
import { useSetRole } from '../hooks/useAuth'
import { forgetPickedRole, getRememberedRole } from '../roleMemory'

const { Title, Paragraph } = Typography

// LinkedIn never tells us what someone wants to do on Patron (ADR 0011) - a
// LinkedIn sign-up reaches this page with no roles and picks one here, once,
// before the rest of the app (ProtectedRoute enforces the "before"). More
// roles can be added later.
function SelectRolePage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  // Pre-selects the role picked on Create account, if a LinkedIn sign-up
  // carried one over (#75) - the user still has to press Continue, this
  // just saves re-picking what they already chose.
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
