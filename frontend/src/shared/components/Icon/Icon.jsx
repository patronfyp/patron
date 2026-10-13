import styles from './Icon.module.css'

/**
 * A Figma icon drawn in the current text colour.
 *
 * The SVG files exported from Figma have their colour baked in; using one as
 * a CSS mask keeps only its shape, so the icon takes `color` from its parent
 * like text does, and one file serves every colour (grey, green on hover,
 * white on a button).
 *
 * Each file is the icon drawn at the size Figma uses it at, so it is shown at
 * its natural size, centred in a `size` box.
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
