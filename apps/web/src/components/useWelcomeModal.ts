import { useState } from 'react'

const STORAGE_KEY = 'aperture-welcome-dismissed'

export function useWelcomeModal() {
  const [open, setOpen] = useState(false)

  const showWelcome = () => setOpen(true)
  const hideWelcome = () => setOpen(false)
  const resetWelcome = () => {
    localStorage.removeItem(STORAGE_KEY)
    setOpen(true)
  }

  return { open, showWelcome, hideWelcome, resetWelcome }
}
