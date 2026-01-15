import { useEffect, useState, useCallback } from 'react'

export interface DiscoveryPrerequisites {
  ready: boolean
  jellyseerrConfigured: boolean
  enabledUserCount: number
  enabledUsernames: string[]
  message: string | null
}

export function useDiscoveryPrerequisites() {
  const [prerequisites, setPrerequisites] = useState<DiscoveryPrerequisites | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPrerequisites = useCallback(async () => {
    try {
      const response = await fetch('/api/discovery/prerequisites', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setPrerequisites(data)
      }
    } catch (err) {
      console.error('Failed to fetch discovery prerequisites:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrerequisites()
  }, [fetchPrerequisites])

  return {
    prerequisites,
    loading,
    refresh: fetchPrerequisites,
  }
}

