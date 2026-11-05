import type { SxProps, Theme } from '@mui/material'

/** Let adjacent desktop action rows share a single phone toolbar. */
export const mobileActionRowsSx = {
  display: { xs: 'flex', sm: 'contents' },
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: 1,
  mb: { xs: 1, sm: 0 },
} satisfies SxProps<Theme>
