import { Alert } from 'antd'

// Stand-in for a step that is not built yet (Account, Profile, Skills, CV and
// Preferences this sprint). Continue moves past it, so the wizard still flows.
function StepPlaceholder() {
  return (
    <Alert
      type="info"
      showIcon
      title="Coming soon"
      description="This step is not ready yet. Continue to skip it for now - you can come back to it later."
    />
  )
}

export default StepPlaceholder
