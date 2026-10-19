import { useQueryClient } from '@tanstack/react-query'
import { App, Alert, Button, ConfigProvider, Flex, Form, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'

import { wizardTheme } from '@/config/theme'
import { useAuthStore } from '@/features/auth'
import {
  PreferencesStep,
  ProfileStep,
  SkillsStep,
  toFormValues,
  toProfileChanges,
  useProfile,
  useUpdateProfile,
} from '@/features/onboarding'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import ProfileCard from '../components/ProfileCard'
import { profileKeys } from '../hooks/usePublicProfile'
import { fieldErrorsFrom } from '../saveErrors'

import styles from './EditProfilePage.module.css'

/** The onboarding fields, filled with what is saved, in three cards. */
function EditProfileForm({ profile }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)
  const [form] = Form.useForm()
  const updateProfile = useUpdateProfile()

  // The photo is saved the moment it is picked, so the public copy is stale
  // whether the person saves or cancels.
  const goToProfile = () => {
    queryClient.invalidateQueries({ queryKey: profileKeys.public(userId) })
    navigate(`/profile/${userId}`)
  }

  const handleFinish = (values) => {
    updateProfile.mutate(toProfileChanges(values), {
      onSuccess: () => {
        message.success('Profile saved')
        goToProfile()
      },
      onError: (error) => {
        form.setFields(fieldErrorsFrom(error))
        message.error(getApiErrorMessage(error, 'Could not save your profile. Please try again.'))
      },
    })
  }

  return (
    <ConfigProvider theme={wizardTheme}>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={updateProfile.isPending}
        initialValues={toFormValues(profile)}
        onFinish={handleFinish}
        className={styles.form}
      >
        <div className={styles.heading}>
          <h1 className={styles.title}>Edit profile</h1>
          <div className={styles.actions}>
            <Button onClick={goToProfile}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={updateProfile.isPending}>
              Save changes
            </Button>
          </div>
        </div>

        <ProfileCard title="Profile">
          <ProfileStep profile={profile} />
        </ProfileCard>
        <ProfileCard title="Skills">
          <SkillsStep />
        </ProfileCard>
        <ProfileCard title="Preferences">
          <PreferencesStep />
        </ProfileCard>
      </Form>
    </ConfigProvider>
  )
}

/** `/profile/edit` - the signed-in person edits their own profile (`GET`/`PATCH /profile/me`). */
function EditProfilePage() {
  const { data: profile, isPending, isError, refetch } = useProfile()

  if (isPending) {
    return (
      <Flex justify="center" style={{ padding: 80 }}>
        <Spin size="large" />
      </Flex>
    )
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <Alert
          type="error"
          showIcon
          title="Could not load your profile."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <EditProfileForm profile={profile} />
    </div>
  )
}

export default EditProfilePage
