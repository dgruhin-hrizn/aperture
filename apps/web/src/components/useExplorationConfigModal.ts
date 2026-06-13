import { useState } from 'react'

const STORAGE_KEY = 'aperture_exploration_config_dismissed'

export function useExplorationConfigModal() {
  const [open, setOpen] = useState(false)

  const showModal = () => setOpen(true)
  const hideModal = () => setOpen(false)
  const resetModal = () => {
    localStorage.removeItem(STORAGE_KEY)
    setOpen(true)
  }

  return { open, showModal, hideModal, resetModal }
}
