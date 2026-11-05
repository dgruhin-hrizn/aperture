import { IconButton, Link, Tooltip } from '@mui/material'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import { useAuiState } from '@assistant-ui/react'
import { useTranslation } from 'react-i18next'
import { composerActionSx } from './composerStyles'

export interface WebSearchControl {
  available: boolean
  enabled: boolean
  loading: boolean
  running: boolean
  onToggle: () => void
}

export function WebSearchToggle({
  available,
  enabled,
  loading,
  running,
  onToggle,
}: WebSearchControl) {
  const { t } = useTranslation()
  const label = t('encore.webSearch')
  const hint = loading
    ? t('encore.webSearchChecking')
    : available
      ? t(enabled ? 'encore.webSearchOn' : 'encore.webSearchOff')
      : t('encore.webSearchUnavailable')

  return (
    <Tooltip title={hint}>
      <span>
        <IconButton
          aria-label={label}
          aria-pressed={enabled}
          disabled={loading || !available || running}
          onClick={onToggle}
          color={enabled ? 'primary' : 'default'}
          sx={{
            ...composerActionSx,
            bgcolor: enabled ? 'action.selected' : 'transparent',
            alignSelf: 'flex-end',
          }}
        >
          <LanguageOutlinedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )
}

export function WebSearchSource() {
  const source = useAuiState(({ part }) =>
    part.type === 'source' && part.sourceType === 'url' ? part : null
  )
  if (!source) return null

  let url: URL
  try {
    url = new URL(source.url)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null

  return (
    <Link
      href={url.href}
      target="_blank"
      rel="noopener noreferrer"
      variant="caption"
      underline="always"
      sx={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: { xs: 44, sm: 32 },
        boxSizing: 'border-box',
        bgcolor: 'action.hover',
        px: 1.25,
        py: 0.75,
        borderRadius: 2,
        maxWidth: '100%',
        overflowWrap: 'anywhere',
      }}
    >
      {source.title ? `${source.title} · ${url.hostname}` : url.hostname}
    </Link>
  )
}
