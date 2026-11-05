import { lazy, Suspense, useState } from 'react'
import { Box, CircularProgress, Dialog, Fab, Tooltip } from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { useTranslation } from 'react-i18next'
const EncoreWorkspace = lazy(() => import('./assistant/EncoreWorkspace'))

export function AssistantModal() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return <>
    <Tooltip title={t('encore.open')}><Fab aria-label={t('encore.open')} color="primary" onClick={() => setOpen(true)} sx={{ position: 'fixed', bottom: 24, insetInlineEnd: 24, zIndex: 1200, borderRadius: '20px', boxShadow: 6 }}><AutoAwesomeOutlinedIcon /></Fab></Tooltip>
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth={false} fullWidth aria-label="Encore" PaperProps={{ sx: { width: 1200, maxWidth: 'calc(100vw - 32px)', height: 'min(860px, calc(100dvh - 32px))', m: 2, borderRadius: 4, overflow: 'hidden' } }}>
      {open && <Suspense fallback={<Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>}><EncoreWorkspace onClose={() => setOpen(false)} /></Suspense>}
    </Dialog>
  </>
}
