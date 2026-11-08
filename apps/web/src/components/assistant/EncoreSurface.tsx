import { lazy, Suspense, useEffect, useState } from 'react'
import { Box, CircularProgress, Dialog, Fab, Tooltip, useMediaQuery, useTheme } from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { useTranslation } from 'react-i18next'
import { useEncore } from './encoreContext'
const EncoreWorkspace = lazy(() => import('./EncoreWorkspace'))

/** Keep one account-scoped agent mounted while its panel opens, expands and closes. */
export function EncoreSurface({
  mobile,
  onRunningChange,
}: {
  mobile: boolean
  onRunningChange: (running: boolean) => void
}) {
  const { t } = useTranslation()
  const { open, openEncore, closeEncore } = useEncore()
  const [visited, setVisited] = useState(open)
  useEffect(() => {
    if (open) setVisited(true)
  }, [open])
  const [expanded, setExpanded] = useState(false)
  const shortViewport = useMediaQuery('(max-height: 600px)')
  const rtl = useTheme().direction === 'rtl'
  return (
    <>
      {(visited || open) && (
        <Dialog
          open={open}
          onClose={closeEncore}
          keepMounted
          maxWidth={false}
          aria-labelledby="encore-agent-title"
          sx={{
            '& .MuiDialog-container': {
              alignItems: mobile ? 'flex-end' : expanded ? 'center' : 'flex-end',
              justifyContent: mobile || expanded ? 'center' : rtl ? 'flex-start' : 'flex-end',
            },
          }}
          slotProps={{
            backdrop: { sx: { bgcolor: 'rgba(0, 0, 0, .28)' } },
            paper: {
              sx: {
                m: { xs: 1, md: expanded ? 3 : 2 },
                width: { xs: 'calc(100% - 16px)', md: expanded ? 1120 : 480 },
                maxWidth: { xs: 'calc(100% - 16px)', md: 'calc(100% - 48px)' },
                height: mobile
                  ? shortViewport
                    ? 'calc(var(--ap-viewport-height, 100dvh) - 16px)'
                    : 'min(88dvh, calc(var(--ap-viewport-height, 100dvh) - 24px))'
                  : expanded
                    ? 'min(860px, calc(100dvh - 48px))'
                    : 'min(780px, calc(100dvh - 96px))',
                border: 0,
                borderRadius: { xs: '24px', md: '28px' },
                overflow: 'hidden',
                backgroundImage: 'none',
                containerType: 'inline-size',
                containerName: 'encore-agent',
                boxShadow: '0 24px 80px rgba(0, 0, 0, .3)',
              },
            },
          }}
        >
          <Suspense
            fallback={
              <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <CircularProgress aria-label={t('encore.toolWorking')} />
              </Box>
            }
          >
            <EncoreWorkspace
              expanded={!mobile && expanded}
              onExpand={!mobile ? () => setExpanded(!expanded) : undefined}
              onRunningChange={onRunningChange}
            />
          </Suspense>
        </Dialog>
      )}
      {!mobile && !open && (
        <Tooltip title={t('encore.open')}>
          <Fab
            onClick={() => openEncore('chat')}
            aria-label={t('encore.open')}
            color="primary"
            sx={{
              position: 'fixed',
              bottom: 24,
              insetInlineEnd: 24,
              zIndex: 1200,
              borderRadius: '50%',
            }}
          >
            <AutoAwesomeOutlinedIcon />
          </Fab>
        </Tooltip>
      )}
    </>
  )
}
