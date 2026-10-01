import { useState } from 'react'

import { App, Button, Card, Flex, Radio, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

import { useSetRole } from '../hooks/useAuth'

const { Title, Paragraph } = Typography

// LinkedIn never tells us candidate vs company vs both (ADR 0011) - a
// LinkedIn sign-up reaches this page with role=None and picks one here,
// once, before the rest of the app (ProtectedRoute enforces the "before").
const ROLE_OPTIONS = [
  { value: 'candidate', label: 'Candidate', detail: 'Looking for your next role' },
  { value: 'company', label: 'Company', detail: 'Hiring through trust, not cold applications' },
  { value: 'both', label: 'Both', detail: 'Hiring, and open to opportunities yourself' },
]

function SelectRolePage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [role, setRole] = useState(null)
  const { mutate, isPending } = useSetRole()

  const selectedDetail = ROLE_OPTIONS.find((option) => option.value === role)?.detail

  const handleContinue = () => {
    mutate(role, {
      onSuccess: () => navigate('/', { replace: true }),
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
          How will you be using Patron?
        </Paragraph>

        <Radio.Group
          block
          optionType="button"
          buttonStyle="solid"
          value={role}
          disabled={isPending}
          onChange={(event) => setRole(event.target.value)}
          options={ROLE_OPTIONS.map(({ value, label }) => ({ value, label }))}
        />

        {selectedDetail ? (
          <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            {selectedDetail}
          </Paragraph>
        ) : null}

        <Button
          type="primary"
          block
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
