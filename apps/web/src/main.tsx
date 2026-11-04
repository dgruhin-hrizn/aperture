import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n/config'
import App from './App'

// A deployment can replace route chunks while a tab still has the previous entry loaded.
// Reload once per entry bundle; leave persistent network errors to the normal error boundary.
window.addEventListener('vite:preloadError', event => {
  try {
    const key = `aperture:chunk-reload:${import.meta.url}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    event.preventDefault()
    window.location.reload()
  } catch { /* Storage may be disabled; do not risk a reload loop. */ }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)



