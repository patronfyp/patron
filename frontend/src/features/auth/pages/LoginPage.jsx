import { Flex, Typography } from 'antd'

const { Title, Paragraph } = Typography

// Placeholder — the real form lands in #19 (Login page and auth store).
function LoginPage() {
  return (
    <Flex vertical justify="center" align="center" style={{ minHeight: '100%', padding: 24 }}>
      <Title level={3}>Login</Title>
      <Paragraph type="secondary">Coming soon.</Paragraph>
    </Flex>
  )
}

export default LoginPage
