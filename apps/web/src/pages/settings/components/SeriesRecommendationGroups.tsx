import { useEffect, useState } from 'react'
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { LibraryConfig } from '../types'

interface Group {
  id: string
  name: string
  sourceIds: string[]
}

const endpoint = '/api/settings/libraries/series-groups'

function newGroupId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}

export function SeriesRecommendationGroups({ libraries }: { libraries: LibraryConfig[] }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoint, { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load TV recommendation groups')
        const result = await response.json()
        setSupported(result.supported)
        setGroups(result.groups)
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message)
      })
    return () => controller.abort()
  }, [])

  function edit(next: Group[]) {
    setGroups(next)
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save TV recommendation groups')
      setGroups(result.groups)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save TV recommendation groups')
    } finally {
      setSaving(false)
    }
  }

  if (supported === false) return null

  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Typography variant="subtitle1">Emby TV recommendation groups</Typography>
      <Typography variant="body2" color="text.secondary">
        Assign TV sources to named outputs. Without groups, Aperture uses one combined TV library.
        When groups overlap, the first group that selects a title gets it. Other non-admin Emby
        accounts must have explicit library access and cannot have access to a user’s generated output.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success">Groups saved. Run TV recommendations and TV library sync to apply.</Alert>}
      {groups?.map((group, index) => (
        <Stack key={group.id} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Group name"
            value={group.name}
            disabled={saving}
            inputProps={{ maxLength: 80 }}
            onChange={(event) => edit(groups.map((item, i) => i === index ? { ...item, name: event.target.value } : item))}
          />
          <TextField
            select
            fullWidth
            label="Source libraries"
            disabled={saving}
            value={group.sourceIds}
            SelectProps={{ multiple: true }}
            onChange={(event) => {
              const value = event.target.value as unknown as string | string[]
              const sourceIds = typeof value === 'string' ? value.split(',') : value
              edit(groups.map((item, i) => i === index ? { ...item, sourceIds } : item))
            }}
          >
            {libraries.map((library) => (
              <MenuItem key={library.id} value={library.providerLibraryId}>{library.name}</MenuItem>
            ))}
          </TextField>
          <Button disabled={saving} onClick={() => edit(groups.filter((_, i) => i !== index))}>Remove</Button>
        </Stack>
      ))}
      {groups && (
        <Box display="flex" gap={1}>
          <Button
            disabled={saving || groups.length >= 20}
            onClick={() => edit([...groups, { id: newGroupId(), name: '', sourceIds: [] }])}
          >
            Add group
          </Button>
          <Button
            variant="contained"
            disabled={saving || groups.some((group) => !group.name.trim() || !group.sourceIds.length)}
            onClick={save}
          >
            Save groups
          </Button>
        </Box>
      )}
    </Stack>
  )
}
