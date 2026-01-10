import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetupStatus } from '@/hooks/useSetupStatus'
import { useAuth } from '@/hooks/useAuth'
import {
  STEP_ORDER,
  DEFAULT_AI_RECS_OUTPUT,
  DEFAULT_TOP_PICKS,
  DEFAULT_MEDIA_SERVER_TYPES,
  DEFAULT_LIBRARY_IMAGES,
} from '../constants'
import type {
  SetupStepId,
  SetupProgress,
  LibraryConfig,
  AiRecsOutputConfig,
  TopPicksConfig,
  MediaServerType,
  SetupWizardContext,
  LibraryImageInfo,
  SetupUser,
  DiscoveredServer,
  JobProgress,
} from '../types'

// Define the initial jobs with their descriptions
const INITIAL_JOBS: Array<{ id: string; name: string; description: string }> = [
  { id: 'sync-movies', name: 'Sync Movies', description: 'Importing movie metadata from your media server' },
  { id: 'sync-series', name: 'Sync Series', description: 'Importing TV series metadata from your media server' },
  {
    id: 'sync-movie-watch-history',
    name: 'Sync Movie Watch History',
    description: 'Importing your movie watch history to understand preferences',
  },
  {
    id: 'sync-series-watch-history',
    name: 'Sync Series Watch History',
    description: 'Importing your TV watch history to understand preferences',
  },
  {
    id: 'generate-movie-embeddings',
    name: 'Generate Movie Embeddings',
    description: 'Creating AI embeddings to understand movie content and themes',
  },
  {
    id: 'generate-series-embeddings',
    name: 'Generate Series Embeddings',
    description: 'Creating AI embeddings to understand TV series content and themes',
  },
  {
    id: 'generate-movie-recommendations',
    name: 'Generate Movie Recommendations',
    description: 'Creating personalized movie recommendations for each user',
  },
  {
    id: 'generate-series-recommendations',
    name: 'Generate Series Recommendations',
    description: 'Creating personalized TV series recommendations for each user',
  },
  {
    id: 'sync-movie-libraries',
    name: 'Sync Movie Libraries',
    description: 'Creating recommendation libraries in your media server',
  },
  {
    id: 'sync-series-libraries',
    name: 'Sync Series Libraries',
    description: 'Creating recommendation libraries in your media server',
  },
]

export function useSetupWizard(): SetupWizardContext {
  const navigate = useNavigate()
  const { status, markComplete } = useSetupStatus()
  const { user } = useAuth()

  // Navigation state
  const [activeStep, setActiveStep] = useState(0)
  const [progress, setProgress] = useState<SetupProgress | null>(null)

  // Media Server state
  const [mediaServerTypes, setMediaServerTypes] = useState<MediaServerType[]>([])
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([])
  const [discoveringServers, setDiscoveringServers] = useState(false)
  const [serverType, setServerType] = useState<string>('emby')
  const [serverUrl, setServerUrl] = useState('')
  const [serverApiKey, setServerApiKey] = useState('')
  const [serverName, setServerName] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  // Existing media server config (masked API key for display)
  const [existingMediaServer, setExistingMediaServer] = useState<{
    type: string
    baseUrl: string
    maskedApiKey: string
  } | null>(null)

  // Libraries
  const [libraries, setLibraries] = useState<LibraryConfig[]>([])
  const [loadingLibraries, setLoadingLibraries] = useState(false)

  // AI rec output
  const [aiRecsOutput, setAiRecsOutput] = useState<AiRecsOutputConfig>(DEFAULT_AI_RECS_OUTPUT)
  // Initialize with bundled default images
  const [libraryImages, setLibraryImages] = useState<Record<string, LibraryImageInfo>>({
    'ai-recs-movies': { url: DEFAULT_LIBRARY_IMAGES['ai-recs-movies'], isDefault: true },
    'ai-recs-series': { url: DEFAULT_LIBRARY_IMAGES['ai-recs-series'], isDefault: true },
  })
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)

  // Users state
  const [setupUsers, setSetupUsers] = useState<SetupUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [setupCompleteForUsers, setSetupCompleteForUsers] = useState(false)

  // OpenAI state
  const [openaiKey, setOpenaiKey] = useState('')
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [existingOpenaiKey, setExistingOpenaiKey] = useState<string | null>(null)

  // Top Picks
  const [topPicks, setTopPicks] = useState<TopPicksConfig>(DEFAULT_TOP_PICKS)

  // UI state
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testSuccess, setTestSuccess] = useState(false)
  const [openaiTestSuccess, setOpenaiTestSuccess] = useState(false)
  const [runningJobs, setRunningJobs] = useState(false)
  const [jobLogs, setJobLogs] = useState<string[]>([])
  const [jobsProgress, setJobsProgress] = useState<JobProgress[]>([])
  const [currentJobIndex, setCurrentJobIndex] = useState(-1)

  const stepId = useMemo(() => STEP_ORDER[activeStep]?.id ?? 'mediaServer', [activeStep])

  const goToStep = useCallback((targetStepId: SetupStepId) => {
    setActiveStep(STEP_ORDER.findIndex((s) => s.id === targetStepId))
  }, [])

  // Redirect if setup is already complete
  useEffect(() => {
    if (status && !status.needsSetup) {
      navigate('/login')
    }
  }, [status, navigate])

  // Fetch media server types
  useEffect(() => {
    fetch('/api/setup/media-server-types')
      .then((res) => res.json())
      .then((data) => setMediaServerTypes(data.types || []))
      .catch(() => setMediaServerTypes(DEFAULT_MEDIA_SERVER_TYPES))
  }, [])

  // Fetch existing OpenAI key (masked)
  useEffect(() => {
    fetch('/api/setup/openai', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.configured && data.maskedKey) {
          setExistingOpenaiKey(data.maskedKey)
          setOpenaiTestSuccess(true) // Already validated if it exists
        }
      })
      .catch(() => {
        // Ignore errors
      })
  }, [])

  // Fetch library images (falls back to bundled defaults only if no image exists)
  const fetchLibraryImages = useCallback(async () => {
    const libraryTypes = ['ai-recs-movies', 'ai-recs-series']
    const imagePromises = libraryTypes.map(async (id) => {
      try {
        const response = await fetch(`/api/images/library/${id}?imageType=Primary`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          // If there's any uploaded image, use it (don't override with bundled defaults)
          if (data.url) {
            return { id, url: data.url, isDefault: false }
          }
        }
        // Only fall back to bundled default if no image exists at all
        return { id, url: DEFAULT_LIBRARY_IMAGES[id], isDefault: true }
      } catch {
        // Fall back to bundled default image on error
        return { id, url: DEFAULT_LIBRARY_IMAGES[id], isDefault: true }
      }
    })

    const results = await Promise.all(imagePromises)
    const imageMap: Record<string, LibraryImageInfo> = {}
    results.forEach((r) => {
      imageMap[r.id] = { url: r.url || undefined, isDefault: r.isDefault }
    })
    setLibraryImages(imageMap)
  }, [])

  useEffect(() => {
    fetchLibraryImages()
  }, [fetchLibraryImages])

  // Fetch setup progress + snapshot (resumable)
  useEffect(() => {
    if (!status?.needsSetup) return

    fetch('/api/setup/progress', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.progress) setProgress(data.progress)
        if (data?.snapshot?.libraries) setLibraries(data.snapshot.libraries)
        if (data?.snapshot?.aiRecsOutput) setAiRecsOutput(data.snapshot.aiRecsOutput)
        if (data?.snapshot?.topPicks) setTopPicks((tp) => ({ ...tp, ...data.snapshot.topPicks }))

        // Set existing media server config if configured
        const ms = data?.snapshot?.mediaServer
        if (ms?.isConfigured && ms.type && ms.baseUrl && ms.apiKey) {
          setExistingMediaServer({
            type: ms.type,
            baseUrl: ms.baseUrl,
            maskedApiKey: `${ms.apiKey.slice(0, 4)}...${ms.apiKey.slice(-4)}`,
          })
          setServerType(ms.type)
          setServerUrl(ms.baseUrl)
          setTestSuccess(true) // Already validated if it exists
        }

        const completed = new Set<string>((data?.progress?.completedSteps ?? []) as string[])
        const firstIncompleteIdx = STEP_ORDER.findIndex((s) => !completed.has(s.id))
        setActiveStep(firstIncompleteIdx === -1 ? STEP_ORDER.length - 1 : firstIncompleteIdx)
      })
      .catch(() => {
        // non-fatal
      })
  }, [status?.needsSetup])

  const updateProgress = useCallback(
    async (opts: { currentStep?: SetupStepId | null; completedStep?: SetupStepId }) => {
      try {
        await fetch('/api/setup/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(opts),
        })
        if (opts.completedStep) {
          setProgress((p) => {
            const prev = p?.completedSteps ?? []
            return {
              completedSteps: Array.from(new Set([...prev, opts.completedStep!])),
              currentStep: opts.completedStep!,
            }
          })
        }
      } catch {
        // non-fatal
      }
    },
    []
  )

  // Media Server handlers
  const discoverServers = useCallback(async () => {
    setDiscoveringServers(true)
    setError('')
    try {
      const response = await fetch('/api/setup/discover-servers', { credentials: 'include' })
      const data = await response.json()
      setDiscoveredServers(data.servers || [])
      if (data.servers?.length === 0) {
        setError('No servers found on network. You can still enter the server details manually.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed')
      setDiscoveredServers([])
    } finally {
      setDiscoveringServers(false)
    }
  }, [])

  const selectDiscoveredServer = useCallback((server: DiscoveredServer) => {
    setServerType(server.type)
    setServerUrl(server.address)
    setServerName(server.name)
    setTestSuccess(false)
    setError('')
  }, [])

  const handleTestMediaServer = useCallback(async () => {
    setTesting(true)
    setError('')
    setTestSuccess(false)

    try {
      const response = await fetch('/api/setup/media-server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: serverType,
          baseUrl: serverUrl,
          apiKey: serverApiKey,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setTestSuccess(true)
        setServerName(data.serverName || '')
      } else {
        setError(data.error || 'Connection test failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }, [serverType, serverUrl, serverApiKey])

  const handleSaveMediaServer = useCallback(async () => {
    // If using existing config and no new values entered, just continue
    if (existingMediaServer && !serverApiKey) {
      await updateProgress({ completedStep: 'mediaServer' })
      goToStep('mediaLibraries')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/setup/media-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: serverType,
          baseUrl: serverUrl,
          apiKey: serverApiKey,
        }),
      })

      const data = await response.json()

      if (data.success || response.ok) {
        await updateProgress({ completedStep: 'mediaServer' })
        goToStep('mediaLibraries')
      } else {
        setError(data.error || 'Failed to save configuration')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }, [serverType, serverUrl, serverApiKey, existingMediaServer, updateProgress, goToStep])

  // Libraries handlers
  const loadLibraries = useCallback(async () => {
    setLoadingLibraries(true)
    setError('')
    try {
      const res = await fetch('/api/setup/libraries', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch libraries')
      setLibraries(data.libraries || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch libraries')
    } finally {
      setLoadingLibraries(false)
    }
  }, [])

  const saveLibraries = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          libraries: libraries.map((l) => ({ providerLibraryId: l.providerLibraryId, isEnabled: l.isEnabled })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save libraries')
      setLibraries(data.libraries || libraries)
      await updateProgress({ completedStep: 'mediaLibraries' })
      goToStep('aiRecsLibraries')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save libraries')
    } finally {
      setSaving(false)
    }
  }, [libraries, updateProgress, goToStep])

  // AI Recs handlers
  const saveAiRecsOutput = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup/ai-recs-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(aiRecsOutput),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save output format')
      setAiRecsOutput(data)
      await updateProgress({ completedStep: 'aiRecsLibraries' })
      goToStep('users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save output format')
    } finally {
      setSaving(false)
    }
  }, [aiRecsOutput, updateProgress, goToStep])

  const uploadLibraryImage = useCallback(async (libraryType: string, file: File) => {
    setUploadingImage(libraryType)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/admin/images/library/${libraryType}/default?imageType=Primary`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      setLibraryImages((prev) => ({
        ...prev,
        [libraryType]: { url: data.url, isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
      throw err
    } finally {
      setUploadingImage(null)
    }
  }, [])

  const deleteLibraryImage = useCallback(async (libraryType: string) => {
    setUploadingImage(libraryType)
    setError('')
    try {
      const res = await fetch(`/api/admin/images/library/${libraryType}/default?imageType=Primary`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Delete failed')
      }

      // Revert to bundled default image
      setLibraryImages((prev) => ({
        ...prev,
        [libraryType]: { url: DEFAULT_LIBRARY_IMAGES[libraryType], isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image')
      throw err
    } finally {
      setUploadingImage(null)
    }
  }, [])

  // Users handlers
  const fetchSetupUsers = useCallback(async () => {
    setLoadingUsers(true)
    setUsersError(null)
    setSetupCompleteForUsers(false)

    try {
      const res = await fetch('/api/setup/users', { credentials: 'include' })
      const data = await res.json()

      if (res.status === 403) {
        // Setup is complete - show friendly message
        setSetupCompleteForUsers(true)
        setUsersError(data.error || 'Setup is complete. Manage users in Admin → Users.')
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch users')
      }

      const users = data.users as SetupUser[]
      setSetupUsers(users)

      // Auto-import admin users with movies+series enabled
      const adminUsers = users.filter((u) => u.isAdmin && !u.isImported)
      for (const adminUser of adminUsers) {
        try {
          const importRes = await fetch('/api/setup/users/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              providerUserId: adminUser.providerUserId,
              moviesEnabled: true,
              seriesEnabled: true,
            }),
          })
          if (importRes.ok) {
            const importData = await importRes.json()
            // Update local state with the imported user
            setSetupUsers((prev) =>
              prev.map((u) =>
                u.providerUserId === adminUser.providerUserId
                  ? {
                      ...u,
                      apertureUserId: importData.user?.id || null,
                      isImported: true,
                      isEnabled: true,
                      moviesEnabled: true,
                      seriesEnabled: true,
                    }
                  : u
              )
            )
          }
        } catch {
          // Non-fatal - admin can manually enable later
        }
      }
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  const importAndEnableUser = useCallback(
    async (providerUserId: string, moviesEnabled: boolean, seriesEnabled: boolean) => {
      setUsersError(null)
      try {
        const res = await fetch('/api/setup/users/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ providerUserId, moviesEnabled, seriesEnabled }),
        })

        if (res.status === 403) {
          const data = await res.json()
          setSetupCompleteForUsers(true)
          setUsersError(data.error || 'Setup is complete.')
          return
        }

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to import user')

        // Update local state
        setSetupUsers((prev) =>
          prev.map((u) =>
            u.providerUserId === providerUserId
              ? {
                  ...u,
                  apertureUserId: data.user?.id || u.apertureUserId,
                  isImported: true,
                  isEnabled: moviesEnabled || seriesEnabled,
                  moviesEnabled,
                  seriesEnabled,
                }
              : u
          )
        )
      } catch (err) {
        setUsersError(err instanceof Error ? err.message : 'Failed to import user')
      }
    },
    []
  )

  const toggleUserMovies = useCallback(
    async (providerUserId: string, enabled: boolean) => {
      const user = setupUsers.find((u) => u.providerUserId === providerUserId)
      if (!user) return

      if (!user.isImported) {
        // Need to import first
        await importAndEnableUser(providerUserId, enabled, false)
      } else {
        // Update existing user
        setUsersError(null)
        try {
          const res = await fetch('/api/setup/users/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apertureUserId: user.apertureUserId, moviesEnabled: enabled }),
          })

          if (res.status === 403) {
            const data = await res.json()
            setSetupCompleteForUsers(true)
            setUsersError(data.error || 'Setup is complete.')
            return
          }

          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Failed to update user')

          setSetupUsers((prev) =>
            prev.map((u) =>
              u.providerUserId === providerUserId
                ? { ...u, moviesEnabled: enabled, isEnabled: enabled || u.seriesEnabled }
                : u
            )
          )
        } catch (err) {
          setUsersError(err instanceof Error ? err.message : 'Failed to update user')
        }
      }
    },
    [setupUsers, importAndEnableUser]
  )

  const toggleUserSeries = useCallback(
    async (providerUserId: string, enabled: boolean) => {
      const user = setupUsers.find((u) => u.providerUserId === providerUserId)
      if (!user) return

      if (!user.isImported) {
        // Need to import first
        await importAndEnableUser(providerUserId, false, enabled)
      } else {
        // Update existing user
        setUsersError(null)
        try {
          const res = await fetch('/api/setup/users/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ apertureUserId: user.apertureUserId, seriesEnabled: enabled }),
          })

          if (res.status === 403) {
            const data = await res.json()
            setSetupCompleteForUsers(true)
            setUsersError(data.error || 'Setup is complete.')
            return
          }

          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Failed to update user')

          setSetupUsers((prev) =>
            prev.map((u) =>
              u.providerUserId === providerUserId
                ? { ...u, seriesEnabled: enabled, isEnabled: u.moviesEnabled || enabled }
                : u
            )
          )
        } catch (err) {
          setUsersError(err instanceof Error ? err.message : 'Failed to update user')
        }
      }
    },
    [setupUsers, importAndEnableUser]
  )

  // OpenAI handlers
  const handleTestOpenAI = useCallback(async () => {
    setTesting(true)
    setError('')
    setOpenaiTestSuccess(false)

    try {
      const response = await fetch('/api/setup/openai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openaiKey }),
      })

      const data = await response.json()

      if (data.success) {
        setOpenaiTestSuccess(true)
      } else {
        setError(data.error || 'API key validation failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API key validation failed')
    } finally {
      setTesting(false)
    }
  }, [openaiKey])

  const handleSaveOpenAI = useCallback(async () => {
    if (!openaiKey) {
      await updateProgress({ completedStep: 'openai' })
      goToStep('initialJobs')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/setup/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openaiKey }),
      })

      const data = await response.json()

      if (data.success || response.ok) {
        await updateProgress({ completedStep: 'openai' })
        goToStep('initialJobs')
      } else {
        setError(data.error || 'Failed to save API key')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }, [openaiKey, updateProgress, goToStep])

  // Top Picks handlers
  const saveTopPicks = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/setup/top-picks-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(topPicks),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save Top Picks config')
      setTopPicks((tp) => ({ ...tp, ...data }))
      await updateProgress({ completedStep: 'topPicks' })
      goToStep('openai')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Top Picks config')
    } finally {
      setSaving(false)
    }
  }, [topPicks, updateProgress, goToStep])

  // Jobs handlers - track which logs we've already shown (use ref to persist across renders)
  const lastLogIndexRef = useRef(0)

  const runJobAndWait = useCallback(async (jobIndex: number) => {
    const job = INITIAL_JOBS[jobIndex]
    if (!job) throw new Error(`Invalid job index: ${jobIndex}`)

    setCurrentJobIndex(jobIndex)
    lastLogIndexRef.current = 0

    // Mark job as running
    setJobsProgress((prev) =>
      prev.map((j, i) => (i === jobIndex ? { ...j, status: 'running' as const, message: 'Starting...' } : j))
    )
    setJobLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] ▶ Starting: ${job.name}`])

    // Use setup-specific endpoint that doesn't require auth (only works before setup is complete)
    const startRes = await fetch(`/api/setup/jobs/${job.id}/run`, { method: 'POST', credentials: 'include' })
    const startData = await startRes.json()
    if (!startRes.ok) {
      const errorMsg = startData?.error || `Failed to start ${job.name}`
      setJobsProgress((prev) =>
        prev.map((j, i) => (i === jobIndex ? { ...j, status: 'failed' as const, error: errorMsg } : j))
      )
      setJobLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] ✗ ERROR: ${errorMsg}`])
      throw new Error(errorMsg)
    }

    const jobId = startData.jobId as string

    // Poll for progress
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const pRes = await fetch(`/api/jobs/progress/${jobId}`, { credentials: 'include' })
      const p = await pRes.json()
      if (!pRes.ok) {
        const errorMsg = p?.error || `Failed to fetch progress for ${job.name}`
        setJobsProgress((prev) =>
          prev.map((j, i) => (i === jobIndex ? { ...j, status: 'failed' as const, error: errorMsg } : j))
        )
        throw new Error(errorMsg)
      }

      // Build status message with counts
      let statusMessage = p.currentStep || 'Processing...'
      if (p.itemsTotal > 0) {
        statusMessage = `${p.currentStep || 'Processing'}: ${p.itemsProcessed || 0}/${p.itemsTotal}`
        if (p.currentItem) {
          statusMessage += ` - ${p.currentItem}`
        }
      }

      // Update progress with detailed info
      setJobsProgress((prev) =>
        prev.map((j, i) =>
          i === jobIndex
            ? {
                ...j,
                progress: p.overallProgress ?? p.stepProgress ?? 0,
                message: statusMessage,
                currentStep: p.currentStep,
                itemsProcessed: p.itemsProcessed,
                itemsTotal: p.itemsTotal,
                currentItem: p.currentItem,
              }
            : j
        )
      )

      // Add new logs from the API - always append new entries
      if (p.logs && Array.isArray(p.logs)) {
        const newLogsCount = p.logs.length
        if (newLogsCount > lastLogIndexRef.current) {
          const newLogs = p.logs.slice(lastLogIndexRef.current)
          lastLogIndexRef.current = newLogsCount

          const formattedLogs = newLogs.map((log: { timestamp: string; level: string; message: string }) => {
            const time = new Date(log.timestamp).toLocaleTimeString()
            const levelIcon =
              log.level === 'error' ? '✗' : log.level === 'warn' ? '⚠' : log.level === 'debug' ? '○' : '•'
            return `[${time}] ${levelIcon} ${log.message}`
          })

          if (formattedLogs.length > 0) {
            setJobLogs((prevLogs) => [...prevLogs, ...formattedLogs])
          }
        }
      }

      if (p.status !== 'running') {
        if (p.status === 'failed') {
          const errorMsg = p.error || 'Unknown error'
          setJobsProgress((prev) =>
            prev.map((j, i) => (i === jobIndex ? { ...j, status: 'failed' as const, error: errorMsg } : j))
          )
          setJobLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] ✗ FAILED: ${errorMsg}`])
          throw new Error(`${job.name} failed: ${errorMsg}`)
        }

        // Completed - add summary
        const summary = p.result
          ? Object.entries(p.result)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          : ''

        setJobsProgress((prev) =>
          prev.map((j, i) =>
            i === jobIndex
              ? { ...j, status: 'completed' as const, progress: 100, itemsProcessed: p.itemsTotal, itemsTotal: p.itemsTotal }
              : j
          )
        )
        setJobLogs((l) => [
          ...l,
          `[${new Date().toLocaleTimeString()}] ✓ Completed: ${job.name}${summary ? ` (${summary})` : ''}`,
        ])
        return
      }

      await new Promise((r) => setTimeout(r, 500)) // Poll every 500ms for more responsive log updates
    }
  }, [])

  const runInitialJobs = useCallback(async () => {
    // No auth required - setup endpoint only works before setup is complete
    // Initialize job progress
    setJobsProgress(
      INITIAL_JOBS.map((job) => ({
        id: job.id,
        name: job.name,
        description: job.description,
        status: 'pending' as const,
      }))
    )
    setCurrentJobIndex(-1)
    setRunningJobs(true)
    setError('')
    setJobLogs([`[${new Date().toLocaleTimeString()}] Starting initial setup jobs...`])

    try {
      for (let i = 0; i < INITIAL_JOBS.length; i++) {
        await runJobAndWait(i)
      }
      setJobLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] All jobs completed successfully!`])
      await updateProgress({ completedStep: 'initialJobs' })
      goToStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run initial jobs')
      setJobLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] Setup failed: ${err instanceof Error ? err.message : 'Unknown error'}`])
    } finally {
      setRunningJobs(false)
      setCurrentJobIndex(-1)
    }
  }, [runJobAndWait, updateProgress, goToStep])

  // Complete handler
  const handleCompleteSetup = useCallback(async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (data.success || response.ok) {
        markComplete()
        goToStep('complete')
      } else {
        setError(data.error || 'Failed to complete setup')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup')
    } finally {
      setSaving(false)
    }
  }, [markComplete, goToStep])

  return {
    // State
    activeStep,
    progress,
    stepId,
    mediaServerTypes,
    discoveredServers,
    discoveringServers,
    serverType,
    serverUrl,
    serverApiKey,
    serverName,
    showApiKey,
    existingMediaServer,
    libraries,
    loadingLibraries,
    aiRecsOutput,
    libraryImages,
    uploadingImage,
    setupUsers,
    loadingUsers,
    usersError,
    setupCompleteForUsers,
    openaiKey,
    showOpenaiKey,
    existingOpenaiKey,
    topPicks,
    testing,
    saving,
    error,
    testSuccess,
    openaiTestSuccess,
    runningJobs,
    jobLogs,
    jobsProgress,
    currentJobIndex,

    // Actions
    setActiveStep,
    goToStep,
    discoverServers,
    selectDiscoveredServer,
    setServerType: (type: string) => {
      setServerType(type)
      setTestSuccess(false)
    },
    setServerUrl: (url: string) => {
      setServerUrl(url)
      setTestSuccess(false)
    },
    setServerApiKey: (key: string) => {
      setServerApiKey(key)
      setTestSuccess(false)
    },
    setShowApiKey,
    handleTestMediaServer,
    handleSaveMediaServer,
    setLibraries,
    loadLibraries,
    saveLibraries,
    setAiRecsOutput,
    saveAiRecsOutput,
    uploadLibraryImage,
    deleteLibraryImage,
    fetchSetupUsers,
    importAndEnableUser,
    toggleUserMovies,
    toggleUserSeries,
    setOpenaiKey: (key: string) => {
      setOpenaiKey(key)
      setOpenaiTestSuccess(false)
    },
    setShowOpenaiKey,
    handleTestOpenAI,
    handleSaveOpenAI,
    setTopPicks,
    saveTopPicks,
    runInitialJobs,
    handleCompleteSetup,
    updateProgress,
  }
}

