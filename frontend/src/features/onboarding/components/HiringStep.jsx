import { App, Button, Col, Form, Input, InputNumber, Row, Segmented, Select } from 'antd'

import chevronDownIcon from '@/assets/icons/chevron-down.svg'
import plusIcon from '@/assets/icons/plus-12.svg'
import xIcon from '@/assets/icons/x-12.svg'
import { useUpdateCompany } from '@/features/companies'
import { HIRING_TIMELINES, jobSummary, useCreateJob, WORK_MODES } from '@/features/jobs'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'

import { useStepControls } from '../hooks/useStepControls'

import styles from './HiringStep.module.css'

/**
 * The recruiter's step 4 - the roles they're hiring for (Figma 67:1170).
 * Left out, on purpose: the AI job-description box and the "38 candidates /
 * 88% match" aside, both of which need real data this project doesn't have
 * (#107's own acceptance criteria).
 *
 * @param {object} props
 * @param {import('@/features/jobs/api/jobs.api').Job[]} props.jobs - this
 *   company's already-drafted jobs (#106's `GET /companies/me/jobs`)
 * @param {import('@/features/companies/api/companies.api').Company} props.company
 */
function HiringStep({ jobs, company }) {
  const { message } = App.useApp()
  const form = Form.useFormInstance()
  const createJob = useCreateJob()
  const updateCompany = useUpdateCompany()

  useStepControls({
    beforeContinue: async () => {
      let values
      try {
        values = await form.validateFields()
      } catch {
        return false // antd is already showing the field errors
      }

      const rows = (values.roles ?? []).filter((row) => row?.title?.trim())
      try {
        await Promise.all(rows.map((row) => createJob.mutateAsync(row)))
        await updateCompany.mutateAsync({ hiring_timeline: form.getFieldValue('hiring_timeline') })
        form.setFieldValue('roles', [{}])
        return true
      } catch (error) {
        message.error(getApiErrorMessage(error, 'Could not save that role. Please try again.'))
        return false
      }
    },
  })

  return (
    <div className={styles.fields}>
      <p className={styles.label}>Roles you are hiring for</p>

      {jobs.map((job) => (
        <div key={job.id} className={styles.jobRow}>
          <span className={styles.jobText}>
            <span className={styles.jobTitle}>{job.title}</span>
            <span className={styles.jobDetail}>{jobSummary(job)}</span>
          </span>
          <span className={styles.openingsChip}>
            {job.openings} {job.openings === 1 ? 'opening' : 'openings'}
          </span>
        </div>
      ))}

      <Form.List name="roles" initialValue={[{}]}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <div key={field.key} className={styles.roleForm}>
                <Row gutter={12}>
                  <Col flex="auto">
                    <Form.Item name={[field.name, 'title']} className={styles.formItem}>
                      <Input placeholder="e.g. Software Engineer III" maxLength={200} />
                    </Form.Item>
                  </Col>
                  <Col flex="none">
                    <Button
                      type="text"
                      className={styles.removeButton}
                      aria-label="Remove this role"
                      onClick={() => remove(field.name)}
                    >
                      <Icon src={xIcon} size={14} />
                    </Button>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} sm={8}>
                    <Form.Item name={[field.name, 'location']} className={styles.formItem}>
                      <Input placeholder="Location" maxLength={200} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Item
                      name={[field.name, 'work_mode']}
                      initialValue="onsite"
                      className={styles.formItem}
                    >
                      <Select
                        options={WORK_MODES}
                        suffixIcon={<Icon src={chevronDownIcon} className={styles.fieldIcon} />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={4}>
                    <Form.Item
                      name={[field.name, 'openings']}
                      initialValue={1}
                      className={styles.formItem}
                    >
                      <InputNumber min={1} max={50} className={styles.openingsInput} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={3}>
                    <Form.Item name={[field.name, 'salary_min']} className={styles.formItem}>
                      <InputNumber min={0} placeholder="Min PKR" className={styles.salaryInput} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={3}>
                    <Form.Item name={[field.name, 'salary_max']} className={styles.formItem}>
                      <InputNumber min={0} placeholder="Max PKR" className={styles.salaryInput} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            ))}

            <Button type="text" className={styles.addButton} onClick={() => add({})}>
              <Icon src={plusIcon} size={14} />
              Add a role
            </Button>
          </>
        )}
      </Form.List>

      <Form.Item name="hiring_timeline" initialValue={company.hiring_timeline} noStyle>
        <HiringTimeline />
      </Form.Item>
    </div>
  )
}

/** "How soon do you need to hire?" (Figma 67:1170) - antd's Segmented. */
function HiringTimeline({ value, onChange }) {
  return (
    <div className={styles.timeline}>
      <p className={styles.label}>How soon do you need to hire?</p>
      <Segmented options={HIRING_TIMELINES} value={value} onChange={onChange} />
    </div>
  )
}

export default HiringStep
