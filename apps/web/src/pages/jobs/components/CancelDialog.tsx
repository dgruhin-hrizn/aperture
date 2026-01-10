import React from 'react'
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
      <DialogTitle sx={{ fontWeight: 600 }}>Stop Job?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to stop <strong>{jobName && formatJobName(jobName)}</strong>? The
          job will be cancelled and any progress will be lost.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Keep Running
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          Stop Job
        </Button>
      </DialogActions>
    </Dialog>
  )
}



