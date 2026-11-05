import { Tabs, useMediaQuery, useTheme, type TabsProps } from '@mui/material'

export function PageTabs({ sx, variant, scrollButtons, ...props }: TabsProps) {
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'))

  return (
    <Tabs
      {...props}
      variant={phone ? 'scrollable' : variant}
      scrollButtons={phone ? false : scrollButtons}
      sx={[
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        (theme) => ({
          [theme.breakpoints.down('sm')]: {
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              minWidth: 44,
              maxWidth: 'none',
              px: 1.25,
              py: 0,
              fontSize: '0.8125rem',
              whiteSpace: 'nowrap',
            },
            '& .MuiTab-icon, & .MuiTab-iconWrapper': { display: 'none' },
          },
        }),
      ]}
    />
  )
}
