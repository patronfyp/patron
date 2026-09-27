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

// jsdom does not implement ResizeObserver either, and antd's Select/dropdown
// components use it to position themselves. Without this stub they throw.
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
