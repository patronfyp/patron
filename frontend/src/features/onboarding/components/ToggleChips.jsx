import checkIcon from '@/assets/icons/check-12.svg'
import plusIcon from '@/assets/icons/plus-12.svg'
import Icon from '@/shared/components/Icon/Icon'

import styles from './ToggleChips.module.css'

/**
 * Multi-select chips - Figma Chip/accent (picked, with a tick) and
 * Chip/neutral (+). The Preferences step's roles (65:545) and the referrer's
 * teams (67:591). Plugs into antd's Form.Item via `value` / `onChange`.
 *
 * @param {object} props
 * @param {{ value: string, label: string }[]} props.options
 * @param {string[]} [props.value]
 * @param {(value: string[]) => void} [props.onChange]
 * @param {string} [props.id] - set by Form.Item so its label points at the group
 */
function ToggleChips({ options, value = [], onChange, id }) {
  function toggle(item) {
    onChange?.(value.includes(item) ? value.filter((picked) => picked !== item) : [...value, item])
  }

  return (
    <div className={styles.chips} id={id} role="group">
      {options.map((option) => {
        const isPicked = value.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.chip} ${isPicked ? styles.picked : ''}`}
            aria-pressed={isPicked}
            onClick={() => toggle(option.value)}
          >
            <Icon src={isPicked ? checkIcon : plusIcon} size={12} />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default ToggleChips
