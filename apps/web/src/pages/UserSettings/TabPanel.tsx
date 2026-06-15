import React from 'react'
import { Box } from '@mui/material'

export interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

export function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}
