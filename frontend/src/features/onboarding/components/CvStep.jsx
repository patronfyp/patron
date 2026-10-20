import { useRef, useState } from 'react'

import { App, Button } from 'antd'

import fileIcon from '@/assets/icons/file-20.svg'
import trashIcon from '@/assets/icons/trash.svg'
import uploadIcon from '@/assets/icons/upload-22.svg'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'

import { useRemoveCv, useUploadCv } from '../hooks/useProfile'

import styles from './CvStep.module.css'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Step 5 - upload a CV (Figma 65:354), saved as soon as it's picked.
 * The AI box waits for Module 9.
 *
 * @param {object} props
 * @param {import('../api/onboarding.api').Profile} props.profile
 */
function CvStep({ profile }) {
  const { message } = App.useApp()
  const fileInput = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const uploadCv = useUploadCv()
  const removeCv = useRemoveCv()
  const cv = profile.cv

  function upload(file) {
    if (!file) return
    uploadCv.mutate(file, {
      onError: (error) =>
        message.error(getApiErrorMessage(error, 'Could not upload the CV. Please try again.')),
    })
  }

  return (
    <div className={styles.fields}>
      <button
        type="button"
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        onClick={() => fileInput.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          upload(event.dataTransfer.files?.[0])
        }}
        disabled={uploadCv.isPending}
      >
        <span className={styles.uploadTile}>
          <Icon src={uploadIcon} size={22} />
        </span>
        <span className={styles.dropTitle}>
          {uploadCv.isPending
            ? 'Uploading…'
            : cv
              ? 'Drop a new CV to replace'
              : 'Drop your CV here, or click to choose'}
        </span>
        <span className={styles.dropHint}>PDF or DOCX, up to 5 MB</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className={styles.fileInput}
        onChange={(event) => {
          upload(event.target.files?.[0])
          event.target.value = ''
        }}
        aria-label="CV file"
      />

      {cv ? (
        <div className={styles.file}>
          <span className={styles.fileTile}>
            <Icon src={fileIcon} size={20} />
          </span>
          <span className={styles.fileText}>
            <span className={styles.fileRow}>
              <span className={styles.fileName}>{cv.filename}</span>
              <span className={styles.fileSize}>{formatSize(cv.size_bytes)}</span>
            </span>
            <span className={styles.progress}>
              <span className={styles.progressFill} />
            </span>
          </span>
          <Button
            type="text"
            className={styles.trash}
            onClick={() => removeCv.mutate()}
            loading={removeCv.isPending}
            aria-label="Remove CV"
          >
            <Icon src={trashIcon} size={14} />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default CvStep
