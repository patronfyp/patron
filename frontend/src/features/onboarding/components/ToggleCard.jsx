import { Switch } from 'antd'

import styles from './ToggleCard.module.css'

/**
 * A card with a title, a hint and a switch - the Preferences step's
 * "Let verified referrers find me" (65:527) and the referrer's request
 * toggles (67:620, 67:626). Use inside a Form.Item with valuePropName="value".
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.hint
 * @param {boolean} [props.value]
 * @param {(checked: boolean) => void} [props.onChange]
 * @param {string} [props.id] - set by Form.Item
 */
function ToggleCard({ title, hint, value, onChange, id }) {
  return (
    <label className={styles.card} htmlFor={id}>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
      <Switch id={id} checked={value} onChange={onChange} />
    </label>
  )
}

export default ToggleCard
