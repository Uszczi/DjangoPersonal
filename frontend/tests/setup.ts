// Make Testing Library DOM matchers available in every Vitest test.
import '@testing-library/jest-dom/vitest'

// jsdom does not implement scrolling; the router calls it on every navigation.
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true })
