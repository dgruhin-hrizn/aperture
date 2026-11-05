import { lazy, Suspense, useState, useEffect } from 'react'
import { Box, CircularProgress, Fab, Tooltip } from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
const EncoreWorkspace = lazy(() => import('./EncoreWorkspace'))
/** One account-scoped runtime survives navigation; hidden transcripts never enter the accessibility tree. */
export function EncoreSurface({
  visible,
  mobile,
  onRunningChange,
}: {
  visible: boolean
  mobile: boolean
  onRunningChange: (running: boolean) => void
}) {
  const { t } = useTranslation(),
    [visited, setVisited] = useState(visible)
  useEffect(() => {
    if (visible) setVisited(true)
  }, [visible])
  return (
    <>
      {(visited || visible) && (
        <Box
          hidden={!visible}
          aria-label="Encore"
          sx={{
            display: visible ? 'flex' : 'none',
            flexDirection: 'column',
            minHeight: 0,
            height: '100%',
            borderRadius: { xs: 0, md: 4 },
            overflow: 'hidden',
            border: { md: '1px solid' },
            borderColor: 'divider',
          }}
        >
          <Suspense
            fallback={
              <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <CircularProgress aria-label={t('encore.toolWorking')} />
              </Box>
            }
          >
            <EncoreWorkspace onRunningChange={onRunningChange} />
          </Suspense>
        </Box>
      )}
      {!mobile && !visible && (
        <Tooltip title={t('encore.open')}>
          <Fab
            component={Link}
            to="/encore"
            aria-label={t('encore.open')}
            color="primary"
            sx={{
              position: 'fixed',
              bottom: 24,
              insetInlineEnd: 24,
              zIndex: 1200,
              borderRadius: 3,
            }}
          >
            <AutoAwesomeOutlinedIcon />
          </Fab>
        </Tooltip>
      )}
    </>
  )
}
