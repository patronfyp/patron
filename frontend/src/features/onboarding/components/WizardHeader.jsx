import markImage from '@/assets/brand/patron-mark-dark.svg'
import checkCircleIcon from '@/assets/icons/check-circle-13.svg'
import Icon from '@/shared/components/Icon/Icon'

import { STEPS } from '../lib/steps'

import styles from './WizardShell.module.css'

const pad = (number) => String(number).padStart(2, '0')

/**
 * The top bar and step progress shared by the wizard and the All set screen.
 *
 * @param {object} props
 * @param {number} props.step - 1-based current step; steps.length + 1 marks every step done
 * @param {string} props.label - centre text, e.g. "Step 2 of 7 · Profile"
 * @param {import('react').ReactNode} props.action - the button on the right
 * @param {{ key: string, label: string }[]} [props.steps] - defaults to the candidate's seven
 * @param {string} [props.chip] - shown beside the logo, e.g. "Referrer" (Figma 67:648)
 */
function WizardHeader({ step, label, action, steps = STEPS, chip }) {
  return (
    <>
      <header className={styles.topBar}>
        <span className={styles.brand}>
          <span className={styles.logo}>
            <img src={markImage} width="26" height="26" alt="" />
            PATRON
          </span>
          {chip ? <span className={styles.chip}>{chip}</span> : null}
        </span>
        <span className={styles.stepLabel}>{label}</span>
        {action}
      </header>

      <nav aria-label="Onboarding progress">
        <ol className={styles.progress} style={{ '--step-count': steps.length }}>
          {steps.map((item, index) => {
            const number = index + 1
            const isDone = number < step
            const isCurrent = number === step
            return (
              <li
                key={item.key}
                className={`${styles.segment} ${isDone ? styles.done : ''} ${
                  isCurrent ? styles.current : ''
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className={styles.bar} />
                <span className={styles.segmentLabel}>
                  {isDone ? (
                    <Icon src={checkCircleIcon} size={13} className={styles.doneIcon} />
                  ) : (
                    <span className={styles.number}>{pad(number)}</span>
                  )}
                  {item.label}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}

export default WizardHeader
