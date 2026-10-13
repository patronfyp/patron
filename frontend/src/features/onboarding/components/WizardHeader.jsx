import markImage from '@/assets/brand/patron-mark-dark.svg'
import checkCircleIcon from '@/assets/icons/check-circle-13.svg'
import Icon from '@/shared/components/Icon/Icon'

import { STEPS } from '../steps'

import styles from './WizardShell.module.css'

const pad = (number) => String(number).padStart(2, '0')

/**
 * The top bar and 7-step progress shared by the wizard and the All set screen.
 *
 * @param {object} props
 * @param {number} props.step - 1-based current step; STEPS.length + 1 marks every step done
 * @param {string} props.label - centre text, e.g. "Step 2 of 7 · Profile"
 * @param {import('react').ReactNode} props.action - the button on the right
 */
function WizardHeader({ step, label, action }) {
  return (
    <>
      <header className={styles.topBar}>
        <span className={styles.logo}>
          <img src={markImage} width="26" height="26" alt="" />
          PATRON
        </span>
        <span className={styles.stepLabel}>{label}</span>
        {action}
      </header>

      <nav aria-label="Onboarding progress">
        <ol className={styles.progress}>
          {STEPS.map((item, index) => {
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
