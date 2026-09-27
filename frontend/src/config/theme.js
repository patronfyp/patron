/**
 * Antd theme tokens — the brand palette from the marketing site (patron-web),
 * light mode only for now. Dark mode is Sprint 16 (15.2) — when it lands, this
 * is the only file that needs a second palette.
 *
 * Colours are literal hex/rgb values, not CSS custom properties: antd derives
 * hover/active/border shades from each seed token using colour math, which
 * needs a real colour to compute from, not a `var(--brand)` reference.
 */
export const theme = {
  token: {
    colorPrimary: '#12915a',
    colorLink: '#12915a',

    colorBgLayout: '#f6f5f1',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#fbfaf7',

    colorText: '#1a2026',
    colorTextSecondary: '#58636c',
    colorTextTertiary: '#8a949c',

    colorBorder: 'rgba(26, 32, 38, 0.2)',
    colorBorderSecondary: 'rgba(26, 32, 38, 0.11)',

    borderRadius: 8,

    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
}

/**
 * Supplementary tokens for pages with a hero/marketing moment (the auth
 * screens today - STANDARDS.md §4.9). Not fed into antd's ConfigProvider:
 * these are decorative colours for a specific panel, not colours antd derives
 * component states from, and mixing the two would make every antd component
 * quietly inherit a colour meant for one hero panel.
 */
export const brand = {
  deep: '#0e5c3c',
  deeper: '#0a3324',
  onBrand: '#eef6f0',
  onBrandSoft: 'rgba(238, 246, 240, 0.72)',
}

// Headline/display face - pair with theme.token.fontFamily (Inter) for
// everything else. Loaded in index.html alongside Inter.
export const fontDisplay = "'Fraunces', Georgia, 'Times New Roman', serif"
