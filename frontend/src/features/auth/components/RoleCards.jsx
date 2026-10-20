import { SIGNUP_ROLES } from '../lib/roles'

import styles from './RoleCards.module.css'

/**
 * Pick one role, as three cards. Real <input type="radio">s underneath, so
 * arrow keys, Tab and screen readers behave like a native radio group.
 *
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.disabled]
 */
function RoleCards({ value, onChange, disabled }) {
  return (
    <fieldset className={styles.group} disabled={disabled}>
      <legend className={styles.legend}>I want to</legend>
      <div className={styles.cards}>
        {SIGNUP_ROLES.map((role) => {
          const checked = role.value === value
          return (
            <label key={role.value} className={`${styles.card} ${checked ? styles.checked : ''}`}>
              <input
                type="radio"
                className={styles.input}
                name="role"
                value={role.value}
                checked={checked}
                onChange={() => onChange(role.value)}
              />
              <span className={styles.top}>
                {/* The icon file is only a shape; its colour comes from CSS.
                    Quoted: Vite inlines small SVGs as data URLs with spaces
                    in them, which an unquoted url() rejects. */}
                <span
                  className={styles.icon}
                  style={{ '--icon': `url("${role.icon}")` }}
                  aria-hidden="true"
                />
                <span className={styles.radio} aria-hidden="true" />
              </span>
              <span className={styles.title}>{role.title}</span>
              <span className={styles.label}>{role.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default RoleCards
