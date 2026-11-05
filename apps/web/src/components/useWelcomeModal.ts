import { useState } from 'react'
import { saveUserPreferences, type UserPreferences } from '@/hooks/userPreferences'

// Bump only when the welcome tour itself changes. Version 1 used a browser-only flag.
const WELCOME_TOUR_VERSION = 2

export function useWelcomeModal(
  userId: string | undefined,
  preferences: UserPreferences | undefined,
  canPrompt: boolean
) {
  const [manualFor, setManualFor] = useState<string>()
  const [closedFor, setClosedFor] = useState<string>()
  const dismissed = (preferences?.dismissedWelcomeTourVersion ?? 0) >= WELCOME_TOUR_VERSION
  const open = Boolean(
    userId &&
    canPrompt &&
    (manualFor === userId || (preferences && !dismissed && closedFor !== userId))
  )

  function showWelcome() {
    setManualFor(userId)
  }

  function hideWelcome() {
    setManualFor(undefined)
    setClosedFor(userId)
  }

  async function rememberDismissal(signal: AbortSignal) {
    if (!userId) throw new Error('No account available to save the welcome tour preference')
    await saveUserPreferences(userId, { dismissedWelcomeTourVersion: WELCOME_TOUR_VERSION }, signal)
  }

  return { open, dismissed, showWelcome, hideWelcome, rememberDismissal }
}
