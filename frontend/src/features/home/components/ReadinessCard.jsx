import { Link } from 'react-router-dom'

import arrowRightIcon from '@/assets/icons/arrow-right.svg'
import { brand, readiness } from '@/config/theme'
import Icon from '@/shared/components/Icon/Icon'

import { verificationChips } from '../lib/verificationChips'

import styles from './ReadinessCard.module.css'

// A 132px ring with an 11px stroke (Figma 10:104).
const SIZE = 132
const STROKE = 11
const RADIUS = (SIZE - STROKE) / 2
const LENGTH = 2 * Math.PI * RADIUS

// The card's literal fills (theme.js `readiness`), as CSS variables.
const CARD_VARS = {
  '--readiness-bg': readiness.bg,
  '--readiness-on-dark': brand.onBrand,
  '--readiness-on-dark-soft': brand.onBrandSoft,
  '--readiness-chip-bg': brand.chipBg,
  '--readiness-chip-border': brand.chipBorder,
  '--readiness-label': readiness.label,
  '--readiness-icon-verified': readiness.iconVerified,
  '--readiness-icon-pending': readiness.iconPending,
  '--readiness-track': readiness.ringTrack,
  '--readiness-glass-bg': readiness.glassBg,
  '--readiness-glass-border': readiness.glassBorder,
}

/**
 * "Referral readiness" (Figma 10:141): how complete the profile is, what is
 * verified, and the next thing to do - from the user's real profile.
 *
 * @param {object} props
 * @param {{ percent: number, nextStep: string | null, remaining: number }} props.strength
 * @param {import('@/features/verification/api/verification.api').VerificationStatus} props.status
 * @param {string} props.profilePath
 */
function ReadinessCard({ strength, status, profilePath }) {
  const done = strength.remaining === 0
  const title = done
    ? 'Your profile is ready for referrals.'
    : `You’re ${strength.remaining} ${strength.remaining === 1 ? 'step' : 'steps'} from a complete profile.`

  return (
    <section className={styles.card} style={CARD_VARS} aria-labelledby="readiness-title">
      <div className={styles.ring} role="img" aria-label={`Profile ${strength.percent}% complete`}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <defs>
            <linearGradient id="readiness-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={readiness.ringFrom} />
              <stop offset="1" stopColor={readiness.ringTo} />
            </linearGradient>
          </defs>
          <circle className={styles.track} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} />
          <circle
            className={styles.progress}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="url(#readiness-gradient)"
            strokeDasharray={LENGTH}
            strokeDashoffset={LENGTH * (1 - strength.percent / 100)}
          />
        </svg>
        <span className={styles.percent}>{strength.percent}%</span>
        <span className={styles.ready}>Ready</span>
      </div>

      <div className={styles.text}>
        <p className={styles.eyebrow}>Referral readiness</p>
        <h2 id="readiness-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.body}>
          {done
            ? 'Everything on your profile is filled in. Keep it current as you grow.'
            : `Next: ${strength.nextStep}.`}
        </p>
        <ul className={styles.chips}>
          {verificationChips(status).map((chip) => (
            <li key={chip.key} className={styles.chip}>
              <Icon src={chip.icon} size={12} className={styles[chip.tone]} />
              {chip.label}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.actions}>
        {done ? null : (
          <Link to="/profile/edit" className={styles.ivory}>
            Finish profile
            <Icon src={arrowRightIcon} />
          </Link>
        )}
        <Link to={profilePath} className={styles.glass}>
          View profile
        </Link>
      </div>
    </section>
  )
}

export default ReadinessCard
