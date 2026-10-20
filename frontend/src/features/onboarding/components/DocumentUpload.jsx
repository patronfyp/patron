import { useRef } from 'react'

import { App, Button } from 'antd'

import { useUploadVerificationDocument } from '@/features/verification'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import styles from './DocumentUpload.module.css'

/**
 * Upload a transcript or employment letter for review; shows "waiting for
 * review" once one exists.
 *
 * @param {object} props
 * @param {'university' | 'employer'} props.kind
 * @param {string} props.buttonLabel - e.g. "Upload transcript or degree"
 * @param {string} props.inputLabel - the hidden file input's accessible name
 * @param {boolean} [props.hasPendingDocument] - one is already uploaded and pending
 */
function DocumentUpload({ kind, buttonLabel, inputLabel, hasPendingDocument = false }) {
  const { message } = App.useApp()
  const fileInput = useRef(null)
  const upload = useUploadVerificationDocument()

  function handlePicked(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    upload.mutate(
      { kind, file },
      {
        onError: (error) =>
          message.error(getApiErrorMessage(error, 'Could not upload the file. Please try again.')),
      },
    )
  }

  if (upload.data) {
    return (
      <p className={styles.pending}>
        <strong>{upload.data.filename}</strong> is uploaded and waiting for review.
      </p>
    )
  }

  if (hasPendingDocument) {
    return <p className={styles.pending}>Your document is uploaded and waiting for review.</p>
  }

  return (
    <div className={styles.upload}>
      <Button onClick={() => fileInput.current?.click()} loading={upload.isPending}>
        {buttonLabel}
      </Button>
      <span className={styles.hint}>PDF, JPG or PNG, up to 5 MB.</span>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className={styles.fileInput}
        onChange={handlePicked}
        aria-label={inputLabel}
      />
    </div>
  )
}

export default DocumentUpload
