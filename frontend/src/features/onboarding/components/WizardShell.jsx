import { Button, theme, Typography } from 'antd'

import { STEPS } from '../steps'

import styles from './WizardShell.module.css'

const { Title, Paragraph } = Typography

/**
 * The frame every onboarding step sits in: top bar, 7-step progress, the
 * step's own content, an optional info card, and the Back / Continue row.
 *
 * @param {object} props
 * @param {number} props.step - 1-based current step
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {import('react').ReactNode} props.children - the step's content
 * @param {import('react').ReactNode} [props.aside] - info card beside the step
 * @param {import('react').ReactNode} [props.secondaryAction] - e.g. "Skip for now"
 * @param {string} props.continueLabel
 * @param {boolean} props.isSaving
 * @param {() => void} props.onBack
 * @param {() => void} props.onContinue
 * @param {() => void} props.onSaveExit
 */
function WizardShell({
  step,
  title,
  subtitle,
  children,
  aside,
  secondaryAction,
  continueLabel,
  isSaving,
  onBack,
  onContinue,
  onSaveExit,
}) {
  const { token } = theme.useToken()
  const current = STEPS[step - 1]

  // antd's live theme tokens as CSS variables, so the module never hard-codes a colour.
  const themeVars = {
    '--ob-primary': token.colorPrimary,
    '--ob-on-primary': token.colorTextLightSolid,
    '--ob-bg-layout': token.colorBgLayout,
    '--ob-bg-container': token.colorBgContainer,
    '--ob-border': token.colorBorderSecondary,
    '--ob-text': token.colorText,
    '--ob-text-secondary': token.colorTextSecondary,
    '--ob-text-tertiary': token.colorTextTertiary,
    '--ob-radius': `${token.borderRadiusLG}px`,
  }

  return (
    <div className={styles.screen} style={themeVars}>
      <header className={styles.topBar}>
        <span className={styles.wordmark}>
          <span className={styles.wordmarkBadge} aria-hidden="true">
            P
          </span>
          Patron
        </span>
        <span className={styles.stepLabel}>
          Step {step} of {STEPS.length} &middot; {current.label}
        </span>
        <Button type="text" onClick={onSaveExit} disabled={isSaving}>
          Save &amp; exit
        </Button>
      </header>

      <nav aria-label="Onboarding progress">
        <ol className={styles.progress}>
          {STEPS.map((item, index) => {
            const number = index + 1
            const state =
              number < step ? styles.segmentDone : number === step ? styles.segmentCurrent : ''
            return (
              <li
                key={item.key}
                className={`${styles.segment} ${state}`}
                aria-current={number === step ? 'step' : undefined}
              >
                <span className={styles.segmentBar} />
                <span className={styles.segmentLabel}>
                  {String(number).padStart(2, '0')} {item.label}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>

      <main className={styles.body}>
        <section className={styles.main}>
          <p className={styles.eyebrow}>Step {String(step).padStart(2, '0')}</p>
          <Title level={2} className={styles.title}>
            {title}
          </Title>
          <Paragraph type="secondary" className={styles.subtitle}>
            {subtitle}
          </Paragraph>

          {children}

          <div className={styles.footer}>
            {step > 1 ? (
              <Button type="text" onClick={onBack} disabled={isSaving}>
                &larr; Back
              </Button>
            ) : (
              <span />
            )}
            <div className={styles.footerActions}>
              {secondaryAction}
              <Button type="primary" onClick={onContinue} loading={isSaving}>
                {continueLabel} &rarr;
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
