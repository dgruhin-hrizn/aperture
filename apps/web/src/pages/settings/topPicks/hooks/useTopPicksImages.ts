import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LIBRARY_IMAGES } from '../../../setup/constants'
import type { LibraryImageInfo } from '../types'

export function useTopPicksImages(setError: (error: string | null) => void) {
  const { t } = useTranslation()
  const [images, setImages] = useState<Record<string, LibraryImageInfo>>({
    'top-picks-movies': { url: DEFAULT_LIBRARY_IMAGES['top-picks-movies'], isDefault: true },
    'top-picks-series': { url: DEFAULT_LIBRARY_IMAGES['top-picks-series'], isDefault: true },
  })
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  const fetchImages = useCallback(async () => {
    const libraryTypes = ['top-picks-movies', 'top-picks-series'] as const
    const results = await Promise.all(libraryTypes.map(async (id) => {
      try {
        const response = await fetch(`/api/images/library/${id}?imageType=Primary`, { credentials: 'include' })
        if (response.ok) {
          const data = (await response.json()) as { url?: string }
          if (data.url) return { id, url: data.url, isDefault: false }
        }
      } catch { /* default */ }
      return { id, url: DEFAULT_LIBRARY_IMAGES[id], isDefault: true }
    }))
    const imageMap: Record<string, LibraryImageInfo> = {}
    results.forEach((r) => { imageMap[r.id] = { url: r.url, isDefault: r.isDefault } })
    setImages(imageMap)
  }, [])

  useEffect(() => { void fetchImages() }, [fetchImages])

  const handleUpload = useCallback(async (libraryTypeId: string, file: File) => {
    setUploadingFor(libraryTypeId); setError(null)
    try {
      const formData = new FormData(); formData.append('file', file)
      const response = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, { method: 'POST', credentials: 'include', body: formData })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error || t('topPicksAdmin.errors.uploadFailed'))
      }
      const data = (await response.json()) as { url: string }
      setImages((prev) => ({ ...prev, [libraryTypeId]: { url: data.url, isDefault: true } }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.uploadFailed'))
      throw err
    } finally { setUploadingFor(null) }
  }, [setError, t])

  const handleDeleteImage = useCallback(async (libraryTypeId: string) => {
    setUploadingFor(libraryTypeId); setError(null)
    try {
      const response = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error || t('topPicksAdmin.errors.deleteFailed'))
      }
      setImages((prev) => ({ ...prev, [libraryTypeId]: { url: DEFAULT_LIBRARY_IMAGES[libraryTypeId], isDefault: true } }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('topPicksAdmin.errors.deleteFailed'))
      throw err
    } finally { setUploadingFor(null) }
  }, [setError, t])

  return { images, uploadingFor, handleUpload, handleDeleteImage }
}
