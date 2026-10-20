import Icon from '@/shared/components/Icon/Icon'

import styles from './OptionCards.module.css'

/**
 * Radio buttons drawn as cards (Figma 9:172). Real radios underneath, so the
 * keyboard and screen readers work.
 *
 * @param {object} props
 * @param {string} props.name
 * @param {{ value: string, title: string, badge?: string, description: string, icon?: string }[]} props.options
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {boolean} [props.disabled]
 * @param {string} [props.id] - set by Form.Item so its label points at the group
 */
function OptionCards({ name, options, value, onChange, disabled, id }) {
  return (
    <div className={styles.group} role="radiogroup" id={id}>
      {options.map((option) => {
        const checked = option.value === value
        return (
          <label
            key={option.value}
            className={`${styles.card} ${checked ? styles.cardChecked : ''}`}
          >
            <input
              type="radio"
              className={styles.input}
              name={name}
              value={option.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange?.(option.value)}
            />
            <span className={styles.radio} aria-hidden="true" />
            <span className={styles.text}>
              <span className={styles.title}>
                {option.title}
                {option.badge ? <span className={styles.badge}>{option.badge}</span> : null}
              </span>
              <span className={styles.description}>{option.description}</span>
            </span>
            {option.icon ? <Icon src={option.icon} size={18} className={styles.icon} /> : null}
          </label>
        )
      })}
    </div>
  )
}

export default OptionCards
