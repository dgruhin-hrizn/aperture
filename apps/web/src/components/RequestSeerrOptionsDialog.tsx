import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material'
import type { SeerrRequestOptions } from '../types/seerrRequest'

type RadarrServer = {
  id: number
  name: string
  is4k: boolean
  isDefault: boolean
  activeDirectory: string
  activeProfileId: number
}

type SonarrServer = RadarrServer & {
  activeLanguageProfileId?: number
}

type Profile = { id: number; name: string }
type RootFolder = { id: number; path: string }
type LangProfile = { id: number; name: string }

interface RequestSeerrOptionsDialogProps {
  open: boolean
  mediaType: 'movie' | 'series'
  title: string
  onClose: () => void
  /** Called with selected paths; omit optional keys if user leaves defaults empty (caller may treat as Seerr defaults). */
  onConfirm: (options: SeerrRequestOptions) => void
}

export function RequestSeerrOptionsDialog({
  open,
  mediaType,
  title,
  onClose,
  onConfirm,
}: RequestSeerrOptionsDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [servers, setServers] = useState<(RadarrServer | SonarrServer)[]>([])
  const [serverId, setServerId] = useState<number | ''>('')
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([])
  const [languageProfiles, setLanguageProfiles] = useState<LangProfile[] | null>(null)
  const [serverMeta, setServerMeta] = useState<RadarrServer | SonarrServer | null>(null)

  const [rootFolderPath, setRootFolderPath] = useState('')
  const [profileId, setProfileId] = useState<number | ''>('')
  const [languageProfileId, setLanguageProfileId] = useState<number | ''>('')

  const isMovie = mediaType === 'movie'

  const resetState = useCallback(() => {
    setError(null)
    setServers([])
    setServerId('')
    setProfiles([])
    setRootFolders([])
    setLanguageProfiles(null)
    setServerMeta(null)
    setRootFolderPath('')
    setProfileId('')
    setLanguageProfileId('')
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const path = isMovie ? '/api/seerr/service/radarr' : '/api/seerr/service/sonarr'
    void fetch(path, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        return data as (RadarrServer | SonarrServer)[]
      })
      .then((list) => {
        if (cancelled) return
        const arr = list || []
        setServers(arr)
        if (arr.length >= 1) {
          const preferred = arr.find((s) => s.isDefault) ?? arr[0]
          setServerId(preferred.id)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('seerrRequest.failedLoadServers'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, isMovie, resetState, t])

  useEffect(() => {
    if (!open || serverId === '') {
      return
    }
    let cancelled = false
    setDetailsLoading(true)
    setError(null)
    const path = isMovie
      ? `/api/seerr/service/radarr/${serverId}`
      : `/api/seerr/service/sonarr/${serverId}`
    void fetch(path, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        return data as {
          server: RadarrServer | SonarrServer
          profiles: Profile[]
          rootFolders: RootFolder[]
          languageProfiles?: LangProfile[] | null
        }
      })
      .then((data) => {
        if (cancelled) return
        setServerMeta(data.server)
        setProfiles(data.profiles || [])
        setRootFolders(data.rootFolders || [])
        setLanguageProfiles(data.languageProfiles ?? null)

        const srv = data.server
        const paths = data.rootFolders || []
        const matchPath = paths.find((r) => r.path === srv.activeDirectory)
        setRootFolderPath(matchPath?.path ?? paths[0]?.path ?? '')
        const prof = (data.profiles || []).find((p) => p.id === srv.activeProfileId)
        setProfileId(prof?.id ?? (data.profiles?.[0]?.id ?? ''))

        if (!isMovie && 'activeLanguageProfileId' in srv) {
          const lp = data.languageProfiles
          if (lp?.length) {
            const lang = lp.find((l) => l.id === srv.activeLanguageProfileId)
            setLanguageProfileId(lang?.id ?? lp[0].id)
          } else {
            setLanguageProfileId('')
          }
        } else {
          setLanguageProfileId('')
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('seerrRequest.failedLoadDetails'))
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, serverId, isMovie, t])

  const canSubmit = useMemo(() => {
    if (serverId === '' || !rootFolderPath || profileId === '') return false
    const needsLang = !isMovie && Array.isArray(languageProfiles) && languageProfiles.length > 0
    if (needsLang && languageProfileId === '') return false
    return true
  }, [serverId, rootFolderPath, profileId, languageProfileId, languageProfiles, isMovie])

  const handleConfirm = () => {
    if (!canSubmit || serverId === '') return
    const opts: SeerrRequestOptions = {
      serverId: Number(serverId),
      rootFolder: rootFolderPath,
      profileId: typeof profileId === 'number' ? profileId : Number(profileId),
    }
    if (serverMeta?.is4k) {
      opts.is4k = true
    }
    if (!isMovie && typeof languageProfileId === 'number') {
      opts.languageProfileId = languageProfileId
    }
    onConfirm(opts)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('seerrRequest.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isMovie
            ? t('seerrRequest.subtitleMovie', { title })
            : t('seerrRequest.subtitleSeries', { title })}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {servers.length > 1 && (
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel id="seerr-server-label">{t('seerrRequest.server')}</InputLabel>
                <Select
                  labelId="seerr-server-label"
                  label={t('seerrRequest.server')}
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value as number)}
                >
                  {servers.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                      {s.is4k ? ' (4K)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {servers.length === 0 && !error && !loading && (
              <Alert severity="warning">
                {isMovie ? t('seerrRequest.noServersMovie') : t('seerrRequest.noServersSeries')}
              </Alert>
            )}
            {detailsLoading && serverId !== '' && (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={28} />
              </Box>
            )}
            {!detailsLoading && serverId !== '' && profiles.length > 0 && (
              <>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel id="seerr-root-label">{t('seerrRequest.rootFolder')}</InputLabel>
                  <Select
                    labelId="seerr-root-label"
                    label={t('seerrRequest.rootFolder')}
                    value={rootFolderPath}
                    onChange={(e) => setRootFolderPath(e.target.value as string)}
                  >
                    {rootFolders.map((r) => (
                      <MenuItem key={r.id} value={r.path}>
                        {r.path}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel id="seerr-quality-label">{t('seerrRequest.qualityProfile')}</InputLabel>
                  <Select
                    labelId="seerr-quality-label"
                    label={t('seerrRequest.qualityProfile')}
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value as number)}
                  >
                    {profiles.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {!isMovie && languageProfiles && languageProfiles.length > 0 && (
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel id="seerr-lang-label">{t('seerrRequest.languageProfile')}</InputLabel>
                    <Select
                      labelId="seerr-lang-label"
                      label={t('seerrRequest.languageProfile')}
                      value={languageProfileId}
                      onChange={(e) => setLanguageProfileId(e.target.value as number)}
                    >
                      {languageProfiles.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!canSubmit || loading || detailsLoading}
        >
          {t('seerrRequest.continue')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
