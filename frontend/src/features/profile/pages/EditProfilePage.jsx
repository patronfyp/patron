import { useQueryClient } from '@tanstack/react-query'
import { App, Alert, Button, ConfigProvider, Flex, Form, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'

import { wizardTheme } from '@/config/theme'
import { useAuthStore } from '@/features/auth'
import {
  JobTitleFields,
  PreferencesStep,
  ProfileStep,
  ReferringStep,
  SkillsStep,
  isReferrerOnly,
  toFormValues,
  toProfileChanges,
  useProfile,
  useUpdateProfile,
} from '@/features/onboarding'
import { useVerificationStatus } from '@/features/verification'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import ProfileCard from '../components/ProfileCard'
import { profileKeys } from '../hooks/usePublicProfile'
import { fieldErrorsFrom } from '../lib/saveErrors'

import styles from './EditProfilePage.module.css'

/**
 * The onboarding fields, filled with what is saved, one card per section.
 * Referrers also get their referring settings; a referrer-only user skips the
 * candidate sections (Skills, Preferences).
 *
 * @param {object} props
 * @param {import('@/features/onboarding/api/onboarding.api').Profile} props.profile
 * @param {string | null} props.verifiedUniversity - for the alumni toggle
 */
function EditProfileForm({ profile, verifiedUniversity }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)
  const roles = useAuthStore((state) => state.user?.roles)
  const [form] = Form.useForm()
  const updateProfile = useUpdateProfile()

  const isReferrer = roles?.includes('referrer') ?? false
  const showCandidateSections = !isReferrerOnly(roles)

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
        {isReferrer ? (
          <ProfileCard title="Referrer settings">
            <JobTitleFields />
            <ReferringStep verifiedUniversity={verifiedUniversity} />
          </ProfileCard>
        ) : null}
        {showCandidateSections ? (
          <>
            <ProfileCard title="Skills">
              <SkillsStep />
            </ProfileCard>
            <ProfileCard title="Preferences">
              <PreferencesStep />
            </ProfileCard>
          </>
        ) : null}
      </Form>
    </ConfigProvider>
  )
}

/** `/profile/edit` - the signed-in person edits their own profile (`GET`/`PATCH /profile/me`). */
function EditProfilePage() {
  const { data: profile, isPending, isError, refetch } = useProfile()
  // Waited for too: the form's initial values are read once. A failed load
  // only hides the alumni toggle.
  const { data: status, isPending: isStatusPending } = useVerificationStatus()

  if (isPending || isStatusPending) {
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
      <EditProfileForm
        profile={profile}
        verifiedUniversity={status?.university_email ? profile.university : null}
      />
    </div>
  )
}

export default EditProfilePage
