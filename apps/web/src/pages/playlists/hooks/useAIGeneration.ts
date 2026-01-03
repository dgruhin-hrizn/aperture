import { useState, useCallback } from 'react'
import type { FormData, SnackbarState } from '../types'

interface UseAIGenerationProps {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>
}

export function useAIGeneration({ formData, setFormData, setSnackbar }: UseAIGenerationProps) {
  const [generatingPreferences, setGeneratingPreferences] = useState(false)
  const [generatingName, setGeneratingName] = useState(false)
  const [generatingDescription, setGeneratingDescription] = useState(false)

  const canGenerate = formData.genreFilters.length > 0 || formData.exampleMovies.length > 0

  const generatePreferences = useCallback(async () => {
    if (!canGenerate) {
      setSnackbar({
        open: true,
        message: 'Please select genres or example movies first',
        severity: 'error',
      })
      return
    }

    setGeneratingPreferences(true)
    try {
      const response = await fetch('/api/channels/ai-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          genres: formData.genreFilters,
          exampleMovieIds: formData.exampleMovies.map((m) => m.id),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFormData((prev) => ({ ...prev, textPreferences: data.preferences }))
        setSnackbar({ open: true, message: 'AI preferences generated', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Failed to generate preferences', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate preferences', severity: 'error' })
    } finally {
      setGeneratingPreferences(false)
    }
  }, [canGenerate, formData.genreFilters, formData.exampleMovies, setFormData, setSnackbar])

  const generateName = useCallback(async () => {
    if (!canGenerate) {
      setSnackbar({
        open: true,
        message: 'Please select genres or example movies first',
        severity: 'error',
      })
      return
    }

    setGeneratingName(true)
    try {
      const response = await fetch('/api/channels/ai-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          genres: formData.genreFilters,
          exampleMovieIds: formData.exampleMovies.map((m) => m.id),
          textPreferences: formData.textPreferences || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFormData((prev) => ({ ...prev, name: data.name }))
        setSnackbar({ open: true, message: 'AI name generated', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Failed to generate name', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate name', severity: 'error' })
    } finally {
      setGeneratingName(false)
    }
  }, [canGenerate, formData.genreFilters, formData.exampleMovies, formData.textPreferences, setFormData, setSnackbar])

  const generateDescription = useCallback(async () => {
    if (!canGenerate) {
      setSnackbar({
        open: true,
        message: 'Please select genres or example movies first',
        severity: 'error',
      })
      return
    }

    setGeneratingDescription(true)
    try {
      const response = await fetch('/api/channels/ai-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          genres: formData.genreFilters,
          exampleMovieIds: formData.exampleMovies.map((m) => m.id),
          textPreferences: formData.textPreferences || undefined,
          playlistName: formData.name || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFormData((prev) => ({ ...prev, description: data.description }))
        setSnackbar({ open: true, message: 'AI description generated', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: 'Failed to generate description', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate description', severity: 'error' })
    } finally {
      setGeneratingDescription(false)
    }
  }, [canGenerate, formData.genreFilters, formData.exampleMovies, formData.textPreferences, formData.name, setFormData, setSnackbar])

  return {
    generatingPreferences,
    generatingName,
    generatingDescription,
    canGenerate,
    generatePreferences,
    generateName,
    generateDescription,
  }
}

