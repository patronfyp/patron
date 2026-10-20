/**
 * PATRON 2.0 design tokens, from the Figma file - the only place theme values
 * live. Light mode only for now.
 *
 * Literal hex, not CSS variables: antd computes hover shades from real colours.
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
    // Not a Figma variable: the onboarding icon tiles use accent/primary at
    // 12% opacity as a literal fill (frames 65:53, 65:198).
    tint: 'rgba(12, 133, 88, 0.12)',
  },
  ai: {
    base: '#0b8aa3',
    subtle: '#e7f5f8',
    text: '#08667a',
    // Not Figma variables: ai/base at 12% (Skills aside tile, 9:549) and 18%
    // (AI Insight border, 9:310), as literal fills in the frames.
    tint: 'rgba(11, 138, 163, 0.12)',
    border: 'rgba(11, 138, 163, 0.18)',
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
    // Not a Figma variable: the checklist dots on the onboarding aside use
    // status/success at 14% opacity as a literal fill (frame 65:198).
    successTint: 'rgba(18, 160, 107, 0.14)',
    // Not a Figma variable: status/warning at 12%, the "In review" row tile
    // on the All set card (65:790).
    warningTint: 'rgba(219, 138, 14, 0.12)',
    // Not Figma variables: the row icon tiles on the Notifications Panel
    // (14:968) use status/success and status/warning at 10% as literal fills.
    successTile: 'rgba(18, 160, 107, 0.1)',
    warningTile: 'rgba(219, 138, 14, 0.1)',
  },
}

/**
 * One colour per endorsement tier. Emerald stays for "verified" and actions.
 */
export const trust = {
  rec: { base: '#5c6573', subtle: '#eff1f3', text: '#3d4450' },
  // tint / border: the tier's base at 12% (icon tiles) and 28% (Trust badge
  // border), as literal fills on the onboarding frames (9:203, 9:337).
  emp: {
    base: '#2f6bbf',
    subtle: '#ebf2fb',
    text: '#1f4e8e',
    tint: 'rgba(47, 107, 191, 0.12)',
    border: 'rgba(47, 107, 191, 0.28)',
  },
  alum: {
    base: '#8a47ab',
    subtle: '#f5eef8',
    text: '#683383',
    tint: 'rgba(138, 71, 171, 0.12)',
    border: 'rgba(138, 71, 171, 0.28)',
  },
  // dv's badge border is 50%, not 28% - literal on the Referring frame (67:641).
  dv: {
    base: '#c08a17',
    subtle: '#fbf4e2',
    text: '#8a6209',
    tint: 'rgba(192, 138, 23, 0.12)',
    border: 'rgba(192, 138, 23, 0.5)',
  },
}

/** Figma's Elevation/1-3 and Glow/Emerald effects, as CSS box-shadows. */
export const elevation = {
  1: '0 1px 2px rgba(34, 38, 43, 0.05), 0 0 0 1px rgba(34, 38, 43, 0.04)',
  2: '0 2px 4px rgba(34, 38, 43, 0.04), 0 8px 20px rgba(34, 38, 43, 0.07)',
  3: '0 4px 10px rgba(34, 38, 43, 0.06), 0 24px 48px rgba(34, 38, 43, 0.14)',
  glow: '0 10px 32px rgba(18, 160, 107, 0.35)',
  // Candidate · Profile (14:2): the hairline under a secondary button and a card.
  button: '0 0 0 rgba(34, 38, 43, 0.04), 0 1px 1px rgba(34, 38, 43, 0.05)',
  // Button/dark (14:157) and Button/primary: the drop shadow plus a 1px highlight.
  buttonPrimary: '0 1px 1px rgba(33, 38, 43, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
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

    // Read off the Sign in frame (9:3); buttons and checkbox differ, set below.
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
      primaryShadow: elevation.buttonPrimary,
      defaultShadow: elevation.button,
    },
    // Figma "Keep me signed in" checkbox: radius 5.
    Checkbox: { borderRadiusSM: 5 },
    // Figma Input/text: a Body S/Medium label 6px above the field.
    Form: { labelFontSize: 13, verticalLabelPadding: '0 0 6px' },
    // Figma Segmented (9:537, 65:501): bg/muted track, 3px padding, 34px
    // items, radius 9 outside / 7 inside, Body S/Medium labels.
    Segmented: {
      trackBg: tokens.bg.muted,
      itemSelectedBg: tokens.bg.surface,
      itemColor: tokens.text.secondary,
      itemSelectedColor: tokens.text.primary,
      trackPadding: 3,
      borderRadius: 9,
      borderRadiusSM: 7,
      controlHeight: 40,
      fontSize: 13,
    },
    // Figma toggle (65:526): 36 x 20 track, 16px knob, 2px inset.
    Switch: { trackHeight: 20, trackMinWidth: 36, handleSize: 16, trackPadding: 2 },
  },
}

/**
 * Nested ConfigProvider theme for the onboarding wizard, whose fields sit 16px
 * apart (frame 65:198) instead of the auth screens' 24.
 */
export const wizardTheme = {
  components: { Form: { itemMarginBottom: 16 } },
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
  bodyMedium: { size: 14, lineHeight: 22, weight: 500, tracking: -0.1 },
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
 * The dark brand panel on the auth screens (Figma 9:4). Kept out of antd's
 * theme so no component inherits them.
 */
export const brand = {
  deep: '#141619', // Brand Panel fill (charcoal/900)
  onBrand: '#f7f6f1', // quote and name text (neutral/25)
  onBrandSoft: '#a9a598', // job-title text (neutral/300)
  onBrandStrong: tokens.text.inverse, // logo and chip text
  chipBg: 'rgba(255, 255, 255, 0.08)', // Chip/dark fill
  chipBorder: 'rgba(255, 255, 255, 0.12)', // Chip/dark stroke
  avatarGradient: 'linear-gradient(135deg, rgb(180, 70, 106) 0%, rgb(217, 122, 152) 100%)',
  // The signed-in user's avatar: Top Navigation (7:603) and Candidate · Profile
  // (14:147). accent/brand to accent/text.
  avatarAccentGradient: `linear-gradient(135deg, ${tokens.accent.brand} 0%, ${tokens.accent.text} 100%)`,
  avatarXlType: { size: 40, lineHeight: 48, weight: 600, tracking: -1 },
  // Text on the panel that doesn't use a named Figma text style.
  logoType: { size: 19, lineHeight: 25, weight: 700, tracking: 4 },
  // The smaller logo in the onboarding top bar (frame 65:53).
  logoSmallType: { size: 16, lineHeight: 20, weight: 700, tracking: 4 },
  // Initials in the 64px onboarding avatar (frame 65:198).
  avatarLType: { size: 23, lineHeight: 28, weight: 600, tracking: -1 },
  // Initials in the 36px top navigation avatar (frame 7:603).
  avatarMType: { size: 13, lineHeight: 16, weight: 600, tracking: -1 },
  // The letter in a 44px company logo tile (frame 9:337).
  logoInitialType: { size: 22, lineHeight: 28, weight: 700, tracking: -4 },
  // The letter in a 32px company logo tile, in the referrer's company field (67:425).
  logoInitialSmallType: { size: 16, lineHeight: 20, weight: 700, tracking: -4 },
  // The percentage inside the profile-strength ring (frame 65:790).
  ringType: { size: 15, lineHeight: 20, weight: 600, tracking: -3 },
  quoteType: { size: 30, lineHeight: 40, weight: 500, tracking: -1.5 },
}

// `600 36px/44px 'Geist', ...` - a style as a CSS `font` shorthand.
const fontShorthand = ({ size, lineHeight, weight }, family = FONT_SANS) =>
  `${weight} ${size}px/${lineHeight}px ${family}`

export const fontMono = FONT_MONO

/**
 * Every token as a `--patron-*` CSS variable, set on <html> by main.jsx, so
 * CSS never hard-codes a value.
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
    // The onboarding aside card and the small icon tile beside the "Code
    // sent to" email (frame 65:53) - nothing antd draws uses them.
    xl: '16px',
    tile: '9px',
    // The CV dropzone and company card (14), the All set card (20), a company
    // logo tile (11) and the Preferences role chips (16).
    card: '14px',
    sheet: '20px',
    logo: '11px',
    pill: '16px',
    // The ⌘K key hint in the top navigation's search box (7:595).
    key: '5px',
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
  addType('logoSmall', brand.logoSmallType)
  addType('avatarL', brand.avatarLType)
  addType('avatarM', brand.avatarMType)
  addType('logoInitial', brand.logoInitialType)
  addType('logoInitialSmall', brand.logoInitialSmallType)
  addType('ring', brand.ringType)
  addType('avatarXl', brand.avatarXlType)
  // Avatars without a photo, on and off the dark auth panel.
  vars['--patron-avatar-gradient'] = brand.avatarGradient
  vars['--patron-avatar-gradient-accent'] = brand.avatarAccentGradient
  addType('quote', brand.quoteType)
  return vars
}
