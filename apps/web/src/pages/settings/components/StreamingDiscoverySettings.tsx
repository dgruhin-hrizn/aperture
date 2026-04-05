import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Switch,
  FormControlLabel,
  TextField,
  Alert,
  CircularProgress,
  Autocomplete,
  Chip,
} from '@mui/material'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import SaveIcon from '@mui/icons-material/Save'

interface PartnerTermRow {
  technicalName: string
  shortName: string
  clearName: string
}

const DEFAULT_STRIPS = ['nfx', 'dnp', 'mxx']

function termForShortCode(code: string, options: PartnerTermRow[]): PartnerTermRow {
  return options.find((o) => o.shortName === code) ?? {
    shortName: code,
    technicalName: '',
    clearName: code,
  }
}

function stripsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

export function StreamingDiscoverySettings() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [initialEnabled, setInitialEnabled] = useState(false)
  const [providerStripCodes, setProviderStripCodes] = useState<string[]>(DEFAULT_STRIPS)
  const [initialProviderStripCodes, setInitialProviderStripCodes] = useState<string[]>([])
  const [providerOptions, setProviderOptions] = useState<PartnerTermRow[]>([])
  const [termsError, setTermsError] = useState(false)

  const sortedOptions = useMemo(
    () => [...providerOptions].sort((a, b) => a.clearName.localeCompare(b.clearName, undefined, { sensitivity: 'base' })),
    [providerOptions]
  )

  /** Include saved codes missing from the US snapshot so chips stay valid and removable. */
  const autocompleteOptions = useMemo(() => {
    const byShort = new Map(sortedOptions.map((o) => [o.shortName, o]))
    for (const code of providerStripCodes) {
      if (!byShort.has(code)) {
        byShort.set(code, termForShortCode(code, providerOptions))
      }
    }
    return [...byShort.values()].sort((a, b) =>
      a.clearName.localeCompare(b.clearName, undefined, { sensitivity: 'base' })
    )
  }, [sortedOptions, providerStripCodes, providerOptions])

  const selectedTerms = useMemo(
    () => providerStripCodes.map((code) => termForShortCode(code, providerOptions)),
    [providerStripCodes, providerOptions]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setTermsError(false)
    try {
      const [settingsRes, termsRes] = await Promise.all([
        fetch('/api/settings/streaming-discovery', { credentials: 'include' }),
        fetch('/api/settings/streaming-discovery/provider-terms-us', { credentials: 'include' }),
      ])

      if (!settingsRes.ok) {
        setError(t('settingsStreamingDiscovery.loadError'))
        return
      }

      const data = (await settingsRes.json()) as {
        streamingDiscoveryEnabled?: boolean
        providerStrips?: string[]
      }
      const on = data.streamingDiscoveryEnabled === true
      setEnabled(on)
      setInitialEnabled(on)
      const strips = Array.isArray(data.providerStrips) && data.providerStrips.length > 0 ? data.providerStrips : DEFAULT_STRIPS
      setProviderStripCodes(strips)
      setInitialProviderStripCodes(strips)

      if (termsRes.ok) {
        const termsData = (await termsRes.json()) as { terms?: PartnerTermRow[] }
        setProviderOptions(Array.isArray(termsData.terms) ? termsData.terms : [])
      } else {
        setProviderOptions([])
        setTermsError(true)
      }
    } catch {
      setError(t('settingsStreamingDiscovery.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/settings/streaming-discovery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          streamingDiscoveryEnabled: enabled,
          providerStrips: providerStripCodes,
        }),
      })
      if (!res.ok) {
        setError(t('settingsStreamingDiscovery.saveError'))
        return
      }
      const data = (await res.json()) as { streamingDiscoveryEnabled?: boolean; providerStrips?: string[] }
      setSuccess(t('settingsStreamingDiscovery.saved'))
      if (data.streamingDiscoveryEnabled !== undefined) {
        setInitialEnabled(data.streamingDiscoveryEnabled === true)
        setEnabled(data.streamingDiscoveryEnabled === true)
      }
      if (Array.isArray(data.providerStrips)) {
        setProviderStripCodes(data.providerStrips)
        setInitialProviderStripCodes(data.providerStrips)
      }
    } catch {
      setError(t('settingsStreamingDiscovery.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const dirty =
    enabled !== initialEnabled || !stripsEqual(providerStripCodes, initialProviderStripCodes)

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <LiveTvIcon color="primary" />
          <Typography variant="h6">{t('settingsStreamingDiscovery.title')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settingsStreamingDiscovery.description')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {termsError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('settingsStreamingDiscovery.providerTermsLoadWarning')}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <FormControlLabel
          control={<Switch checked={enabled} onChange={(_, v) => setEnabled(v)} />}
          label={t('settingsStreamingDiscovery.enable')}
        />

        <Autocomplete
          multiple
          options={autocompleteOptions}
          value={selectedTerms}
          onChange={(_, newValue) => {
            setProviderStripCodes(newValue.map((o) => o.shortName))
          }}
          isOptionEqualToValue={(a, b) => a.shortName === b.shortName}
          getOptionLabel={(o) => `${o.clearName} (${o.shortName})`}
          filterSelectedOptions
          disableCloseOnSelect
          renderTags={(tagValue, getTagProps) =>
            tagValue.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option.shortName}
                size="small"
                label={`${option.clearName} · ${option.shortName}`}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              margin="normal"
              label={t('settingsStreamingDiscovery.providerStrips')}
              helperText={t('settingsStreamingDiscovery.providerStripsHelper')}
              placeholder={t('settingsStreamingDiscovery.providerStripsPlaceholder')}
            />
          )}
          sx={{ mt: 1 }}
        />

        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          disabled={saving || !dirty}
          onClick={() => void handleSave()}
          sx={{ mt: 1 }}
        >
          {t('settingsStreamingDiscovery.save')}
        </Button>
      </CardContent>
    </Card>
  )
}
