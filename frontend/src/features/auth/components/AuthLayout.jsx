import { useEffect, useState } from 'react'

import { Card, Typography } from 'antd'
import { Link, useLocation } from 'react-router-dom'

import { brand, fontDisplay, theme } from '../../../config/theme'

import styles from './AuthLayout.module.css'

const { Title, Paragraph } = Typography

const TABS = [
  { to: '/login', label: 'Sign in' },
  { to: '/register', label: 'Create account' },
]

const TRUST_TIERS = [
  { name: 'Recommendation', detail: 'Anyone in your network can vouch for you' },
  { name: 'Employee Referral', detail: 'A verified employee refers you in' },
  { name: 'Alumni Referral', detail: 'A verified alumnus opens the door' },
]

const TIER_ROTATE_MS = 3200

// Bridges config/theme.js's JS colour tokens into the CSS module as custom
// properties, so this hero panel has one source of truth for colour instead
// of a second, hand-copied palette that can drift from theme.js.
const paneVars = {
  '--pane-deep': brand.deep,
  '--pane-deeper': brand.deeper,
  '--pane-on-brand': brand.onBrand,
  '--pane-on-brand-soft': brand.onBrandSoft,
  '--pane-glow': 'rgba(18, 145, 90, 0.35)',
  '--pane-accent': theme.token.colorPrimary,
  '--pane-font-display': fontDisplay,
  '--pane-tab-track': theme.token.colorBgLayout,
  '--pane-tab-inactive': theme.token.colorTextSecondary,
  '--pane-tab-active': theme.token.colorText,
  '--pane-tab-active-bg': theme.token.colorBgContainer,
}

function CheckBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12" aria-hidden="true">
      <path
        d="M5 12l4.5 4.5L19 7"
        stroke="#eef6f0"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BrandPane() {
  const [activeTier, setActiveTier] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const id = setInterval(() => {
      setActiveTier((current) => (current + 1) % TRUST_TIERS.length)
    }, TIER_ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <aside className={styles.pane}>
      <div className={styles.wordmark}>
        <span className={styles.wordmarkBadge}>P</span>
        Patron
      </div>

      <div className={styles.copy}>
        <p className={styles.eyebrow}>Trust-based hiring</p>
        <h1 className={styles.thesis}>
          Vouched, <em>verified</em>, hired.
        </h1>
        <p className={styles.sub}>
          No cold applications. Every candidate on Patron reaches a company through someone who
          can actually speak for them.
        </p>

        <div className={styles.tiers}>
          {TRUST_TIERS.map((tier, index) => (
            <div
              key={tier.name}
              className={`${styles.tier} ${index === activeTier ? styles.tierActive : ''}`}
            >
              <span className={styles.badge}>
                <CheckBadge />
              </span>
              <span>
                <span className={styles.tierName}>{tier.name}</span>
                <span className={styles.tierDetail}>{tier.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className={styles.quote}>
        Patron auto-tags every connection as <b>Professional</b>, <b>Alumni</b>, or <b>Both</b> -
        that&rsquo;s what decides which of the three ways someone can vouch for you.
      </p>
    </aside>
  )
}

/**
 * Shared hero layout for the auth screens (STANDARDS.md §4.9, ADR 0012):
 * a brand pane stating Patron's actual thesis, paired with an elevated form
 * card. `title`/`subtitle` head the card; `children` is the page's own form.
 */
function AuthLayout({ title, subtitle, children }) {
  const location = useLocation()

  return (
    <div className={styles.screen} style={paneVars}>
      <BrandPane />

      <main className={styles.formPane}>
        <Card className={styles.card}>
          <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
            {title}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 22 }}>
            {subtitle}
          </Paragraph>

          <nav className={styles.tabs} aria-label="Sign in or create an account">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={`${styles.tab} ${location.pathname === tab.to ? styles.tabActive : ''}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {children}
        </Card>
      </main>
    </div>
  )
}

export default AuthLayout
