import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Flex, Spin, Typography } from 'antd'

import { API_BASE_URL } from './config/env'
import { useLogout } from './features/auth'
import { api } from './shared/api/client'

const { Title, Paragraph, Text } = Typography

/**
 * Temporary landing screen: proves the frontend can reach the backend.
 * This will be replaced by the real landing page and router.
 */
function App() {
  const logout = useLogout()
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await api.get('/health')
      return response.data
    },
  })

  return (
    <Flex justify="center" align="center" style={{ minHeight: '100%', padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 520 }}>
        <Flex justify="space-between" align="start">
          <div>
            <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
              Patron
            </Title>
            <Paragraph type="secondary">Vouched, Verified, Hired.</Paragraph>
          </div>
          <Button onClick={logout}>Log out</Button>
        </Flex>

        {isPending && (
          <Flex gap={8} align="center">
            <Spin size="small" />
            <Text type="secondary">Checking backend&hellip;</Text>
          </Flex>
        )}

        {isError && (
          <Alert
            type="error"
            showIcon
            message="Backend not reachable"
            description={
              <>
                <div>{error.message}</div>
                <Text type="secondary">
                  Start the API with <Text code>uv run uvicorn main:app --reload</Text>
                </Text>
              </>
            }
          />
        )}

        {data && (
          <>
            <Alert
              type="success"
              showIcon
              message="Backend connected"
              style={{ marginBottom: 16 }}
            />
            <Descriptions
              size="small"
              column={1}
              bordered
              items={[
                { key: 'status', label: 'Status', children: data.status },
                { key: 'env', label: 'Environment', children: data.env },
                {
                  key: 'baseUrl',
                  label: 'API base URL',
                  children: <Text code>{API_BASE_URL}</Text>,
                },
              ]}
            />
          </>
        )}
      </Card>
    </Flex>
  )
}

export default App
