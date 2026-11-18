import { App, Button, Form, Input, Select } from 'antd'

import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import mailIcon from '@/assets/icons/mail-18.svg'
import plusIcon from '@/assets/icons/plus-12.svg'
import xIcon from '@/assets/icons/x-12.svg'
import { INVITE_ROLES, useCreateCompanyInvite, useUpdateCompany } from '@/features/companies'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'

import { useStepControls } from '../hooks/useStepControls'

import styles from './TeamStep.module.css'
import ToggleCard from './ToggleCard'

const ROLE_LABELS = Object.fromEntries(INVITE_ROLES.map((role) => [role.value, role.label]))

/** "Sent" for a pending invite, "Accepted" for one already joined (#104's status). */
function InviteStatusChip({ status }) {
  if (status === 'expired') {
    return <span className={`${styles.chip} ${styles.chipExpired}`}>Expired</span>
  }
  return (
    <span className={styles.chip}>
      <span className={styles.chipDot} aria-hidden="true" />
      {status === 'accepted' ? 'Accepted' : 'Sent'}
    </span>
  )
}

/**
 * The recruiter's step 3 - inviting their hiring team (Figma 67:1040).
 * Continue sends every row with an email typed in, then saves the
 * employees-can-refer toggle; neither is required to move on.
 *
 * @param {object} props
 * @param {import('@/features/companies/api/companies.api').Company} props.company
 * @param {import('@/features/companies/api/companies.api').CompanyInvite[]} props.invites
 *   - already-sent invites, newest first (#104's `GET /companies/me/invites`)
 */
function TeamStep({ company, invites }) {
  const { message } = App.useApp()
  const form = Form.useFormInstance()
  const createInvite = useCreateCompanyInvite()
  const updateCompany = useUpdateCompany()

  useStepControls({
    beforeContinue: async () => {
      let values
      try {
        // No names list: Form.List's dynamic item paths (invites.0.email, ...)
        // aren't matched by a parent-prefix name, and since this step is the
        // only thing mounted into the shared wizard Form, "every registered
        // field" and "every field of this step" are the same set.
        values = await form.validateFields()
      } catch {
        return false // antd is already showing the field errors
      }

      const rows = (values.invites ?? []).filter((row) => row?.email?.trim())
      // Each invite on its own: if one fails, the ones that went out leave the
      // drafts, so Continue again only retries the failed ones (no 429 resends).
      const results = await Promise.allSettled(rows.map((row) => createInvite.mutateAsync(row)))
      const failed = rows.filter((_row, index) => results[index].status === 'rejected')
      if (failed.length) {
        form.setFieldValue('invites', failed)
        const firstError = results.find((result) => result.status === 'rejected').reason
        message.error(getApiErrorMessage(firstError, 'Could not send an invite. Please try again.'))
        return false
      }
      try {
        await updateCompany.mutateAsync({
          employees_can_refer: form.getFieldValue('employees_can_refer'),
        })
        // The rows just sent now show up in `invites` from the server -
        // clear the drafts instead of listing them twice.
        form.setFieldValue('invites', [{}])
        return true
      } catch (error) {
        message.error(getApiErrorMessage(error, 'Could not save your settings. Please try again.'))
        return false
      }
    },
  })

  return (
    <div className={styles.fields}>
      <p className={styles.label}>Invite people who hire with you</p>

      {invites.map((invite) => (
        <div key={invite.id} className={styles.row}>
          <span className={styles.sentEmail}>{invite.email}</span>
          <span className={styles.sentRole}>{ROLE_LABELS[invite.role]}</span>
          <InviteStatusChip status={invite.status} />
        </div>
      ))}

      <Form.List name="invites" initialValue={[{}]}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <div key={field.key} className={styles.row}>
                <Form.Item
                  name={[field.name, 'email']}
                  rules={[{ type: 'email', message: 'Enter a valid email address' }]}
                  className={styles.emailItem}
                >
                  <Input
                    prefix={<Icon src={mailIcon} className={styles.fieldIcon} />}
                    placeholder={`name@${company.domain}`}
                  />
                </Form.Item>
                <Form.Item name={[field.name, 'role']} initialValue="hiring_manager" noStyle>
                  <Select
                    className={styles.roleSelect}
                    options={INVITE_ROLES}
                    suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
                  />
                </Form.Item>
                <Button
                  type="text"
                  className={styles.removeButton}
                  aria-label="Remove this row"
                  onClick={() => remove(field.name)}
                >
                  <Icon src={xIcon} size={14} />
                </Button>
              </div>
            ))}

            <Button type="text" className={styles.addButton} onClick={() => add({})}>
              <Icon src={plusIcon} size={14} />
              Add another
            </Button>
          </>
        )}
      </Form.List>

      <Form.Item
        name="employees_can_refer"
        valuePropName="value"
        initialValue={company.employees_can_refer}
        noStyle
      >
        <ToggleCard
          title={`Let ${company.name} employees join as referrers`}
          hint={`Anyone with a @${company.domain} email can verify and refer candidates to your roles.`}
        />
      </Form.Item>
    </div>
  )
}

export default TeamStep
