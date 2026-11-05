import React from 'react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { AuthContext, type AuthContextType } from '../hooks/auth-context'

export const locale = createInstance()
await locale
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
export const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
export function wrap(node: React.ReactNode, userId = 'test-a', isAdmin = true) {
  const value = { user: { id: userId, username: userId, isAdmin } } as AuthContextType
  return React.createElement(
    AuthContext.Provider,
    { value },
    React.createElement(I18nextProvider, { i18n: locale }, node)
  )
}
export function browserFixture() {
  const originals = Object.fromEntries(
    ['window', 'document', 'localStorage', 'IntersectionObserver'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  )
  const surface = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    location: { origin: 'http://test.local' },
  })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: surface })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: surface })
  const values: Record<string, string> = {}
  Object.defineProperties(values, {
    getItem: { value: (key: string) => values[key] ?? null },
    setItem: {
      value: (key: string, value: string) => {
        values[key] = value
      },
    },
    removeItem: {
      value: (key: string) => {
        delete values[key]
      },
    },
  })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: values })
  const observers: {
    callback: (entries: IntersectionObserverEntry[]) => void
    disconnected: boolean
  }[] = []
  class Observer {
    disconnected = false
    constructor(public callback: (entries: IntersectionObserverEntry[]) => void) {
      observers.push(this)
    }
    observe() {}
    disconnect() {
      this.disconnected = true
    }
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, value: Observer })
  return {
    surface,
    values,
    observers,
    restore() {
      for (const [key, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}
