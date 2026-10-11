/**
 * PATRON 2.0 design tokens - copied from the Figma file "PATRON 2.0 · Product
 * Design" (Foundations → Brand & design system). Figma is the source of truth:
 * when a value changes there, change it here, nowhere else.
 *
 * Light mode only for now. Figma already has the dark-mode values; when dark
 * mode lands this is the only file that needs a second palette.
 *
 * Colours are literal hex values, not CSS custom properties: antd derives
 * hover/active/border shades from each seed token using colour math, which
 * needs a real colour to compute from, not a `var(--accent)` reference.
 */

const FONT_SANS = "'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
const FONT_MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

/** Semantic tokens - Figma's "Theme" collection, light mode. Screens use these. */
export const tokens = {
  bg: {
    canvas: '#f7f6f1',
    surface: '#ffffff',
    subtle: '#f1efe8',
    muted: '#e9e6dd',
    inverse: '#22262b',
  },
  text: {
    primary: '#22262b',
    secondary: '#4a4842',
    tertiary: '#67645b',
    inverse: '#ffffff',
    onAccent: '#ffffff',
  },
  border: {
    subtle: '#e9e6dd',
    default: '#e1ddd2',
    strong: '#cdc8bb',
  },
  accent: {
    primary: '#0c8558',
    brand: '#12a06b',
    subtle: '#e9f6ef',
    text: '#0a6b47',
  },
  ai: {
    base: '#0b8aa3',
    subtle: '#e7f5f8',
    text: '#08667a',
  },
  status: {
    success: '#12a06b',
    successSubtle: '#e9f6ef',
    successText: '#0a6b47',
    warning: '#db8a0e',
    warningSubtle: '#fdf3e3',
    warningText: '#9a5b00',
    danger: '#d9443f',
    dangerSubtle: '#fcedec',
    dangerText: '#b4262b',
  },
}

/**
 * One colour family per endorsement tier, so a recruiter can tell them apart
 * at a glance. Emerald is reserved for "verified" and primary actions, so no
 * tier uses it.
 */
export const trust = {
  rec: { base: '#5c6573', subtle: '#eff1f3', text: '#3d4450' },
  emp: { base: '#2f6bbf', subtle: '#ebf2fb', text: '#1f4e8e' },
  alum: { base: '#8a47ab', subtle: '#f5eef8', text: '#683383' },
  dv: { base: '#c08a17', subtle: '#fbf4e2', text: '#8a6209' },
}

/** Figma's Elevation/1-3 and Glow/Emerald effects, as CSS box-shadows. */
export const elevation = {
  1: '0 1px 2px rgba(34, 38, 43, 0.05), 0 0 0 1px rgba(34, 38, 43, 0.04)',
  2: '0 2px 4px rgba(34, 38, 43, 0.04), 0 8px 20px rgba(34, 38, 43, 0.07)',
  3: '0 4px 10px rgba(34, 38, 43, 0.06), 0 24px 48px rgba(34, 38, 43, 0.14)',
  glow: '0 10px 32px rgba(18, 160, 107, 0.35)',
}

/** antd ConfigProvider theme - the 2.0 tokens mapped onto antd's seed tokens. */
export const theme = {
  token: {
    colorPrimary: tokens.accent.primary,
    colorLink: tokens.accent.text,
    colorSuccess: tokens.status.success,
    colorWarning: tokens.status.warning,
    colorError: tokens.status.danger,
    colorInfo: tokens.ai.base,

    colorBgLayout: tokens.bg.canvas,
    colorBgContainer: tokens.bg.surface,
    colorBgElevated: tokens.bg.surface,

    colorText: tokens.text.primary,
    colorTextSecondary: tokens.text.secondary,
    colorTextTertiary: tokens.text.tertiary,

    colorBorder: tokens.border.default,
    colorBorderSecondary: tokens.border.subtle,

    // Figma has no radius variables - these are read off the Sign in frame
    // (9:3): chip 6, input field 8, callout card 12. Buttons (10) and the
    // checkbox (5) differ, so they are set per component below.
    borderRadiusSM: 6,
    borderRadius: 8,
    borderRadiusLG: 12,

    // Figma buttons and inputs: sm 32, md 40 (default), lg 48.
    controlHeightSM: 32,
    controlHeight: 40,
    controlHeightLG: 48,

    fontFamily: FONT_SANS,
    fontFamilyCode: FONT_MONO,
    fontSize: 14,

    boxShadow: elevation[2],
    boxShadowSecondary: elevation[3],
  },
  components: {
    // Figma Button/primary and Button/secondary: radius 10 at every size,
    // SemiBold label, shadows as on the Sign in frame (9:3).
    Button: {
      borderRadius: 10,
      borderRadiusSM: 10,
      borderRadiusLG: 10,
      fontWeight: 600,
      primaryShadow: '0 1px 1px rgba(33, 38, 43, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
      defaultShadow: '0 0 0 rgba(34, 38, 43, 0.04), 0 1px 1px rgba(34, 38, 43, 0.05)',
    },
    // Figma "Keep me signed in" checkbox: radius 5.
    Checkbox: { borderRadiusSM: 5 },
  },
}

/**
 * Figma text styles. size and lineHeight are px; tracking is Figma's letter
 * spacing in % of the font size (H2's -2.5 = -0.9px at 36px).
 */
export const typography = {
  display: { size: 64, lineHeight: 72, weight: 600, tracking: -3.5 },
  h1: { size: 48, lineHeight: 56, weight: 600, tracking: -3 },
  h2: { size: 36, lineHeight: 44, weight: 600, tracking: -2.5 },
  h3: { size: 28, lineHeight: 36, weight: 600, tracking: -2 },
  h4: { size: 20, lineHeight: 28, weight: 600, tracking: -1.2 },
  title: { size: 16, lineHeight: 24, weight: 600, tracking: -0.6 },
  bodyL: { size: 16, lineHeight: 26, weight: 400, tracking: -0.2 },
  body: { size: 14, lineHeight: 22, weight: 400, tracking: -0.1 },
  bodySemibold: { size: 14, lineHeight: 22, weight: 600, tracking: -0.2 },
  bodyS: { size: 13, lineHeight: 20, weight: 400, tracking: 0 },
  bodySMedium: { size: 13, lineHeight: 20, weight: 500, tracking: 0 },
  bodySSemibold: { size: 13, lineHeight: 20, weight: 600, tracking: -0.1 },
  caption: { size: 12, lineHeight: 18, weight: 400, tracking: 0 },
  captionMedium: { size: 12, lineHeight: 18, weight: 500, tracking: 0 },
  captionSemibold: { size: 12, lineHeight: 18, weight: 600, tracking: 0 },
  label: { size: 11, lineHeight: 16, weight: 600, tracking: 8 },
  numberL: { size: 30, lineHeight: 36, weight: 600, tracking: -3 },
  mono: { size: 12, lineHeight: 18, weight: 500, tracking: 0 },
}

/**
 * Colours for the dark hero panel on the auth screens. Not fed into antd's
 * ConfigProvider: they colour one panel, and antd components must not inherit
 * them.
 *
 * Values from the Figma "Sign in" frame's Brand Panel (node 9:4).
 */
export const brand = {
  deep: '#141619', // Brand Panel fill (charcoal/900)
  onBrand: '#f7f6f1', // quote and name text (neutral/25)
  onBrandSoft: '#a9a598', // job-title text (neutral/300)
  onBrandStrong: tokens.text.inverse, // logo and chip text
  chipBg: 'rgba(255, 255, 255, 0.08)', // Chip/dark fill
  chipBorder: 'rgba(255, 255, 255, 0.12)', // Chip/dark stroke
  avatarGradient: 'linear-gradient(135deg, rgb(180, 70, 106) 0%, rgb(217, 122, 152) 100%)',
  // Text on the panel that doesn't use a named Figma text style.
  logoType: { size: 19, lineHeight: 25, weight: 700, tracking: 4 },
  quoteType: { size: 30, lineHeight: 40, weight: 500, tracking: -1.5 },
}

// `600 36px/44px 'Geist', ...` - a style as a CSS `font` shorthand.
const fontShorthand = ({ size, lineHeight, weight }, family = FONT_SANS) =>
  `${weight} ${size}px/${lineHeight}px ${family}`

export const fontMono = FONT_MONO

/**
 * Every token above as a CSS custom property (`--patron-bg-canvas`, ...), so
 * plain CSS files read the same values as antd. main.jsx sets these on
 * <html> once at startup - CSS never hard-codes a colour, font, text size or
 * radius.
 */
export function cssVariables() {
  const vars = {
    '--patron-font-sans': FONT_SANS,
    '--patron-font-mono': FONT_MONO,
  }
  const add = (prefix, group) => {
    Object.entries(group).forEach(([key, value]) => {
      const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      vars[`--patron-${prefix}-${name}`] = value
    })
  }
  Object.entries(tokens).forEach(([group, values]) => add(group, values))
  Object.entries(trust).forEach(([tier, values]) => add(`trust-${tier}`, values))
  add('elevation', elevation)
  add('radius', {
    sm: `${theme.token.borderRadiusSM}px`,
    md: `${theme.token.borderRadius}px`,
    lg: `${theme.token.borderRadiusLG}px`,
    button: `${theme.components.Button.borderRadius}px`,
  })

  // --patron-type-h2 (a `font` shorthand) + --patron-type-h2-tracking (em).
  const addType = (name, style, family) => {
    const kebab = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    vars[`--patron-type-${kebab}`] = fontShorthand(style, family)
    vars[`--patron-type-${kebab}-tracking`] = `${style.tracking / 100}em`
  }
  Object.entries(typography).forEach(([name, style]) =>
    addType(name, style, name === 'mono' ? FONT_MONO : FONT_SANS),
  )
  addType('logo', brand.logoType)
  addType('quote', brand.quoteType)
  return vars
}
