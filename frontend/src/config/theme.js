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

    fontFamily:
      "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
}
