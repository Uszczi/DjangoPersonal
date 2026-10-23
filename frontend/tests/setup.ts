// Make Testing Library DOM matchers available in every Vitest test.
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
