import { App, Button } from 'antd'

import glowImage from '@/assets/brand/auth-glow.svg'
import gridImage from '@/assets/brand/auth-grid.svg'
import markOutlineImage from '@/assets/brand/patron-mark-outline.svg'
import markImage from '@/assets/brand/patron-mark.svg'
import capIcon from '@/assets/icons/cap.svg'
import checkCircleIcon from '@/assets/icons/check-circle.svg'
import linkedinIcon from '@/assets/icons/linkedin.svg'
import { brand } from '@/config/theme'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'

import { useLinkedInAuthorize } from '../hooks/useAuth'

import styles from './AuthLayout.module.css'

// Quote on the Figma "Sign in" frame (9:3); "Create account" (64:2) passes its own.
const DEFAULT_QUOTE =
  'The referral came from someone who had actually reviewed my code. That changed the whole conversation.'

// The brand-panel colours from config/theme.js, as CSS variables for the module.
const paneVars = {
  '--pane-bg': brand.deep,
  '--pane-on-brand': brand.onBrand,
  '--pane-on-brand-soft': brand.onBrandSoft,
  '--pane-on-brand-strong': brand.onBrandStrong,
  '--pane-chip-bg': brand.chipBg,
  '--pane-chip-border': brand.chipBorder,
  '--pane-avatar': brand.avatarGradient,
}

function BrandPane({ quote }) {
  return (
    <aside className={styles.pane}>
      <img className={styles.grid} src={gridImage} alt="" />
      <img className={styles.glow} src={glowImage} alt="" />
      <img className={styles.bigMark} src={markOutlineImage} alt="" />

      <div className={styles.logo}>
        <img src={markImage} width="30" height="30" alt="" />
        PATRON
      </div>

      <figure className={styles.testimonial}>
        <blockquote className={styles.quote}>&ldquo;{quote}&rdquo;</blockquote>
        <figcaption className={styles.person}>
          <span className={styles.avatar}>AR</span>
          <span>
            <span className={styles.name}>Abdul Rafay</span>
            <span className={styles.role}>Software Engineer · Garner</span>
          </span>
        </figcaption>
        <div className={styles.chips}>
          <span className={styles.chip}>
            <img src={checkCircleIcon} width="12" height="12" alt="" />
            Employee verified
          </span>
          <span className={styles.chip}>
            <img src={capIcon} width="12" height="12" alt="" />
            LUMS alumna
          </span>
        </div>
      </figure>
    </aside>
  )
}

/**
 * The auth screens' layout (Figma 9:3): brand panel left, form right.
 * `linkedInLabel` adds the LinkedIn button; `beforeLinkedIn` goes above it.
 */
function AuthLayout({
  title,
  subtitle,
  quote = DEFAULT_QUOTE,
  beforeLinkedIn,
  linkedInLabel,
  footer,
  children,
}) {
  const { message } = App.useApp()
  const { mutate: startLinkedIn, isPending: isLinkedInPending } = useLinkedInAuthorize()

  const handleLinkedIn = () => {
    startLinkedIn(undefined, {
      // The authorize request itself failed (backend down, LinkedIn keys
      // missing, ...) - there is no redirect to fail silently into (#75).
      onError: (error) =>
        message.error(
          getApiErrorMessage(error, 'Could not start LinkedIn sign-in. Please try again.'),
        ),
    })
  }

  return (
    <div className={styles.screen} style={paneVars}>
      <BrandPane quote={quote} />

      <main className={styles.formPane}>
        <div className={styles.form}>
          <header className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </header>

          {beforeLinkedIn}

          {linkedInLabel && (
            <>
              <Button
                block
                size="large"
                icon={<img src={linkedinIcon} width="18" height="18" alt="" />}
                loading={isLinkedInPending}
                onClick={handleLinkedIn}
              >
                {linkedInLabel}
              </Button>

              <div className={styles.divider}>or</div>
            </>
          )}

          {children}

          {footer && <p className={styles.footer}>{footer}</p>}
        </div>
      </main>
    </div>
  )
}

export default AuthLayout
