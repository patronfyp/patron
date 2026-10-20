import { Button } from 'antd'

import arrowLeftIcon from '@/assets/icons/arrow-left.svg'
import arrowRightIcon from '@/assets/icons/arrow-right.svg'
import Icon from '@/shared/components/Icon/Icon'

import { STEPS } from '../lib/steps'

import WizardHeader from './WizardHeader'
import styles from './WizardShell.module.css'

const pad = (number) => String(number).padStart(2, '0')

/**
 * The frame every onboarding step sits in - the Figma onboarding frames
 * (65:53 ... 65:545) and the referrer's (67:505, 67:641): top bar, progress, the step's own content, an
 * info card beside it, and the Back / Continue row.
 *
 * @param {object} props
 * @param {number} props.step - 1-based current step
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {import('react').ReactNode} props.children - the step's content
 * @param {import('react').ReactNode} [props.aside] - info card beside the step
 * @param {() => void} [props.onSkip] - shows "Skip for now" when given
 * @param {string} props.continueLabel
 * @param {boolean} props.isSaving
 * @param {() => void} props.onBack
 * @param {() => void} props.onContinue
 * @param {() => void} props.onSaveExit
 * @param {{ key: string, label: string }[]} [props.steps] - defaults to the candidate's seven
 * @param {string} [props.chip] - beside the logo, e.g. "Referrer"
 */
function WizardShell({
  steps = STEPS,
  chip,
  step,
  title,
  subtitle,
  children,
  aside,
  onSkip,
  continueLabel,
  isSaving,
  onBack,
  onContinue,
  onSaveExit,
}) {
  const current = steps[step - 1]

  return (
    <div className={styles.screen}>
      <WizardHeader
        steps={steps}
        chip={chip}
        step={step}
        label={`Step ${step} of ${steps.length} · ${current.label}`}
        action={
          <Button type="text" size="small" className={styles.ghost} onClick={onSaveExit}>
            Save &amp; exit
          </Button>
        }
      />

      <main className={styles.body}>
        <section className={styles.content}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>Step {pad(step)}</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          {children}

          <div className={styles.footer}>
            {step > 1 ? (
              <Button type="text" className={styles.back} onClick={onBack} disabled={isSaving}>
                <Icon src={arrowLeftIcon} />
                Back
              </Button>
            ) : (
              <span />
            )}
            <div className={styles.footerActions}>
              {onSkip ? (
                <Button type="text" className={styles.back} onClick={onSkip} disabled={isSaving}>
                  Skip for now
                </Button>
              ) : null}
              <Button
                type="primary"
                size="large"
                className={styles.continue}
                onClick={onContinue}
                loading={isSaving}
              >
                {continueLabel}
                <Icon src={arrowRightIcon} size={18} />
              </Button>
            </div>
          </div>
        </section>

        {aside ? <aside className={styles.aside}>{aside}</aside> : null}
      </main>
    </div>
  )
}

export default WizardShell
