import '@testing-library/jest-dom/vitest'

// jsdom does not implement scrolling; the router calls it on every navigation.
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true })

// jsdom has HTMLDialogElement but not its modal API; the design-system Modal opens with showModal().
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

// jsdom has no canvas without the native `canvas` package and logs on every
// getContext(); return null quietly instead (components must cope with that).
// Tests that check drawing spy on getContext themselves.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
