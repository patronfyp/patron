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

// The backend's JobCreate limits (backend/app/modules/jobs/schemas.py).
const TITLE_MAX = 150
const LOCATION_MAX = 100

/** A role row only counts once its title is typed; then location is required too. */
const hasTitle = (row) => Boolean(row?.title?.trim())

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

      const rows = (values.roles ?? []).filter(hasTitle)
      // Each role on its own: if one fails, the ones saved leave the drafts,
      // so Continue again doesn't create them twice.
      const results = await Promise.allSettled(rows.map((row) => createJob.mutateAsync(row)))
      const failed = rows.filter((_row, index) => results[index].status === 'rejected')
      if (failed.length) {
        form.setFieldValue('roles', failed)
        const firstError = results.find((result) => result.status === 'rejected').reason
        message.error(getApiErrorMessage(firstError, 'Could not save that role. Please try again.'))
        return false
      }
      form.setFieldValue('roles', [{}])

      // Saved only when it changed - and never as null, which the backend refuses.
      const timeline = form.getFieldValue('hiring_timeline')
      if (timeline && timeline !== company.hiring_timeline) {
        try {
          await updateCompany.mutateAsync({ hiring_timeline: timeline })
        } catch (error) {
          message.error(
            getApiErrorMessage(error, 'Could not save your timeline. Please try again.'),
          )
          return false
        }
      }
      return true
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
                      <Input placeholder="e.g. Software Engineer III" maxLength={TITLE_MAX} />
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
                    <Form.Item
                      name={[field.name, 'location']}
                      className={styles.formItem}
                      dependencies={[['roles', field.name, 'title']]}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator: (_rule, value) =>
                            hasTitle(getFieldValue(['roles', field.name])) && !value?.trim()
                              ? Promise.reject(new Error('Add a location'))
                              : Promise.resolve(),
                        }),
                      ]}
                    >
                      <Input placeholder="Location" maxLength={LOCATION_MAX} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Item
                      name={[field.name, 'work_mode']}
                      initialValue="on_site"
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
                    <Form.Item
                      name={[field.name, 'salary_max']}
                      className={styles.formItem}
                      dependencies={[['roles', field.name, 'salary_min']]}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator: (_rule, max) => {
                            const min = getFieldValue(['roles', field.name, 'salary_min'])
                            return typeof min === 'number' && typeof max === 'number' && min > max
                              ? Promise.reject(new Error('Max is below min'))
                              : Promise.resolve()
                          },
                        }),
                      ]}
                    >
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

      {/* Segmented always shows one option picked, so start on the one shown
          and save it - what the recruiter sees is what gets stored. */}
      <Form.Item
        name="hiring_timeline"
        initialValue={company.hiring_timeline ?? HIRING_TIMELINES[0].value}
        noStyle
      >
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
