import { Box } from '@mui/material'
import type { ReactNode } from 'react'

/** Mobile pages scroll within a pane; tall filter forms must scroll with their results. */
export function BrowseFilterBar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: { xs: 'static', md: 'sticky' },
        top: { md: 64 },
        zIndex: 10,
        bgcolor: 'background.default',
        py: { xs: 0.75, md: 2 },
        mx: { xs: "var(--ap-layout-inset, -16px)", md: -3 },
        px: { xs: "var(--ap-page-gutter, 16px)", md: 3 },
        mb: { xs: 1, sm: 2 },
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {children}
    </Box>
  )
}
