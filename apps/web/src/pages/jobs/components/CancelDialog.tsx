import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material'
import { formatJobName } from '../constants'

interface CancelDialogProps {
  jobName: string | null
  onClose: () => void
  onConfirm: () => void
}

export function CancelDialog({ jobName, onClose, onConfirm }: CancelDialogProps) {
  const { t } = useTranslation()
  const displayName = jobName ? formatJobName(jobName, t) : ''
  return (
    <Dialog
      open={!!jobName}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 3,
          minWidth: 360,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>{t('admin.jobsPage.ui.cancelTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('admin.jobsPage.ui.cancelBody', { name: displayName })}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          {t('admin.jobsPage.ui.keepRunning')}
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          {t('admin.jobsPage.ui.stopJob')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}



