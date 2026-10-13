import { useRef } from 'react'

import { App, Button, Col, Form, Input, Row, Select } from 'antd'

import checkCircleIcon from '@/assets/icons/check-circle-16.svg'
import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import linkedinIcon from '@/assets/icons/linkedin-16.svg'
import pinIcon from '@/assets/icons/pin.svg'
import uploadIcon from '@/assets/icons/upload.svg'
import { useAuthStore } from '@/features/auth'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'

import { fileUrl } from '../api/onboarding.api'
import { useRemovePhoto, useUploadPhoto } from '../hooks/useProfile'
import { LINKEDIN_PATTERN } from '../validation'

import styles from './ProfileStep.module.css'

const BIO_LIMIT = 280

// No city lookup API yet - Pakistan's larger cities, in the "City, Country"
// form the design shows.
const CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Hyderabad',
  'Sialkot',
  'Gujranwala',
].map((city) => ({ value: `${city}, Pakistan`, label: `${city}, Pakistan` }))

function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/**
 * Step 2 - photo, headline, city, phone, LinkedIn and bio (Figma 65:198).
 *
 * The photo is saved the moment it is picked (it is a file, not a form
 * value); everything else is saved by the wizard on Continue.
 *
 * @param {object} props
 * @param {import('../api/onboarding.api').Profile} props.profile
 */
function ProfileStep({ profile }) {
  const { message } = App.useApp()
  const fullName = useAuthStore((state) => state.user?.full_name)
  const fileInput = useRef(null)
  const uploadPhoto = useUploadPhoto()
  const removePhoto = useRemovePhoto()
  const bio = Form.useWatch('bio') ?? ''
  const linkedin = Form.useWatch('linkedin_url') ?? ''

  const photo = fileUrl(profile.photo_url)
  const isPhotoBusy = uploadPhoto.isPending || removePhoto.isPending

  function handlePhotoPicked(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // so picking the same file again still fires
    if (!file) return
    uploadPhoto.mutate(file, {
      onError: (error) =>
        message.error(getApiErrorMessage(error, 'Could not upload the photo. Please try again.')),
    })
  }

  return (
    <div className={styles.fields}>
      <div className={styles.photoRow}>
        <span className={styles.avatar}>
          {photo ? <img src={photo} alt={fullName ?? 'You'} /> : initials(fullName)}
        </span>
        <div className={styles.photoActions}>
          <div className={styles.photoButtons}>
            <Button
              size="small"
              className={styles.uploadButton}
              onClick={() => fileInput.current?.click()}
              loading={uploadPhoto.isPending}
              disabled={isPhotoBusy}
            >
              <Icon src={uploadIcon} size={14} />
              {photo ? 'Change photo' : 'Upload photo'}
            </Button>
            {photo ? (
              <Button
                type="text"
                size="small"
                className={styles.ghost}
                onClick={() => removePhoto.mutate()}
                loading={removePhoto.isPending}
                disabled={isPhotoBusy}
              >
                Remove
              </Button>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png"
              className={styles.fileInput}
              onChange={handlePhotoPicked}
              aria-label="Profile photo"
            />
          </div>
          <span className={styles.hint}>
            JPG or PNG, at least 400&times;400. Profiles with a photo get 2&times; more replies.
          </span>
        </div>
      </div>

      <Form.Item
        name="headline"
        label="Headline"
        rules={[
          { required: true, message: 'Add a headline - it is the first thing referrers read' },
        ]}
      >
        <Input
          placeholder="e.g. Final-year CS student · Backend & distributed systems"
          maxLength={120}
        />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item name="city" label="City">
            <Select
              showSearch
              allowClear
              placeholder="Select your city"
              options={CITIES}
              prefix={<Icon src={pinIcon} className={styles.fieldIcon} />}
              suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="phone"
            label="Phone"
            // Shown as "300 1234567", without the +92 the prefix already
            // displays; saved as "+923001234567".
            getValueProps={(value) => {
              const digits = value?.replace(/^\+92/, '') ?? ''
              return {
                value: digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits,
              }
            }}
            normalize={(value) => {
              const digits = (value ?? '').replace(/[^\d ]/g, '')
              return digits.trim() ? `+92${digits.replace(/\s/g, '').replace(/^0/, '')}` : null
            }}
            rules={[
              {
                pattern: /^\+92\d{10}$/,
                message: 'Enter a 10-digit mobile number, e.g. 300 1234567',
              },
            ]}
          >
            <Input
              prefix={<span className={styles.phonePrefix}>+92</span>}
              placeholder="300 1234567"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="linkedin_url"
        label="LinkedIn profile"
        // Shown the short way the design does; the backend stores the full URL.
        getValueProps={(value) => ({
          value: value?.replace(/^https?:\/\/(www\.)?/, '') ?? '',
        })}
        normalize={(value) => value || null}
        rules={[
          {
            pattern: LINKEDIN_PATTERN,
            message: 'Use your profile URL, e.g. linkedin.com/in/your-name',
          },
        ]}
        extra="We only read your public profile."
      >
        <Input
          prefix={<Icon src={linkedinIcon} className={styles.fieldIcon} />}
          suffix={
            LINKEDIN_PATTERN.test(linkedin) ? (
              <Icon src={checkCircleIcon} className={styles.validIcon} />
            ) : (
              <span />
            )
          }
          placeholder="linkedin.com/in/your-name"
          maxLength={255}
        />
      </Form.Item>

      <Form.Item
        name="bio"
        label="Short bio"
        extra={`${bio.length} / ${BIO_LIMIT}`}
        className={styles.bio}
      >
        <Input.TextArea
          placeholder="What you build, and the role you are looking for."
          maxLength={BIO_LIMIT}
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
      </Form.Item>
    </div>
  )
}

export default ProfileStep
