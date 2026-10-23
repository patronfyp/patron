import styles from './Icon.module.css'

/**
 * A Figma icon in the current text colour (a CSS mask, so one file serves
 * every colour), at its natural size in a `size` box.
 *
 * @param {object} props
 * @param {string} props.src - an imported .svg from src/assets
 * @param {number} [props.size] - the box, in px; defaults to 16
 * @param {string} [props.className]
 */
function Icon({ src, size = 16, className }) {
  return (
    <span
      className={className ? `${styles.icon} ${className}` : styles.icon}
      // Quoted: Vite inlines small SVGs as data URLs with spaces in them,
      // which an unquoted url() rejects.
      style={{ '--icon': `url("${src}")`, '--size': `${size}px` }}
      aria-hidden="true"
    />
  )
}

export default Icon
