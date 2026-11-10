import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom não implementa scrollTo; as telas a chamam ao montar (Screen).
window.scrollTo = vi.fn()
if (typeof Element !== 'undefined') Element.prototype.scrollTo = vi.fn()
