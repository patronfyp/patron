// Runs once before the test suite (wired up in vite.config.js).

// Adds matchers like toBeVisible() and toHaveTextContent() to expect().
import '@testing-library/jest-dom'

// jsdom does not implement window.matchMedia, but several antd components call
// it to decide responsive layout. Without this stub they throw on render.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated, still used by some libraries
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
