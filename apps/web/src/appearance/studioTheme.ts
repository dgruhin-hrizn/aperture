import { alpha, type ThemeOptions } from '@mui/material/styles'

/** Shared components carry the restyle to every existing route, including portals. */
export function studioThemeOptions(mode: 'light' | 'dark'): ThemeOptions {
  const dark = mode === 'dark'
  const bg = dark ? '#0b101c' : '#f1f4fa'
  const paper = dark ? '#131b2a' : '#ffffff'
  const raised = dark ? '#1b2538' : '#e8edf7'
  const line = dark ? '#28334a' : '#d6dfed'
  const ink = dark ? '#f3f6ff' : '#14213b'
  const muted = dark ? '#a2afc6' : '#53647f'
  const accent = dark ? '#87a5ff' : '#254edb'
  const action = dark ? '#3f67f4' : '#294fe5'
  return {
    palette: {
      mode,
      primary: {
        main: accent,
        light: dark ? '#b1c4ff' : '#5778ee',
        dark: action,
        contrastText: dark ? '#0b101c' : '#ffffff',
      },
      secondary: { main: dark ? '#b7d6ff' : '#315c91' },
      background: { default: bg, paper },
      text: { primary: ink, secondary: muted },
      divider: line,
      action: { hover: alpha(accent, 0.07), selected: alpha(accent, 0.13) },
      success: { main: dark ? '#b4e477' : '#49741b' },
      error: { main: dark ? '#ff979c' : '#bd233b' },
      warning: { main: dark ? '#f6ca78' : '#895500' },
      info: { main: accent },
    },
    typography: {
      fontFamily: '"Manrope", "Inter", "Roboto", sans-serif',
      fontSize: 14,
      h1: { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.045em' },
      h2: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em' },
      h3: { fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.035em' },
      h4: { fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.25 },
      h5: { fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.025em' },
      h6: { fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em' },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
      body1: { fontSize: '0.875rem', lineHeight: 1.65 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.6 },
      caption: { fontSize: '0.75rem', lineHeight: 1.5 },
      button: { fontSize: '0.8125rem', fontWeight: 700, textTransform: 'none' },
      overline: { fontSize: '0.6875rem', letterSpacing: '0.13em', fontWeight: 800 },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--ap-image-warning': '#f6ca78',
            '--ap-primary-action': action,
            '--ap-primary-hover': dark ? '#5379ff' : '#2343c7',
            '--ap-surface-1': paper,
            '--ap-surface-2': raised,
            '--ap-border': line,
            '--ap-placeholder': raised,
            '--ap-progress-track': line,
            '--ap-text': ink,
            '--ap-muted': muted,
            '--ap-canvas': bg,
            '--ap-stat-surface': paper,
            '--ap-stat-ink': ink,
            '--ap-stat-label': muted,
            '--ap-stat-icon': accent,
            '--ap-panel-translucent': alpha(paper, 0.96),
            '--ap-modal-translucent': alpha(paper, 0.98),
            '--ap-graph-bg': bg,
            '--ap-graph-node': raised,
            '--ap-graph-text': ink,
            '--ap-graph-tooltip': paper,
            '--ap-rotating-fade': `linear-gradient(to bottom, ${alpha(bg, dark ? 0.6 : 0.7)} 0%, ${alpha(bg, 0.85)} 70%, ${bg} 100%)`,
            '--ap-backdrop-fade': `linear-gradient(to top, ${bg} 0%, ${alpha(bg, 0)} 100%)`,
            '--ap-backdrop-fallback': `linear-gradient(135deg, ${raised} 0%, ${bg} 100%)`,
          },
          body: { backgroundColor: bg, scrollbarColor: `${line} ${bg}` },
          'body::-webkit-scrollbar, body *::-webkit-scrollbar': { width: 8, height: 8 },
          'body::-webkit-scrollbar-thumb, body *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: line,
          },
          'body::-webkit-scrollbar-track, body *::-webkit-scrollbar-track': { backgroundColor: bg },
          '::selection': { backgroundColor: alpha(accent, 0.25) },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { scrollBehavior: 'auto !important' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: line } },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 8,
            border: `1px solid ${line}`,
            boxShadow: 'none',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 5, minHeight: 36, paddingInline: 14 },
          containedPrimary: {
            backgroundColor: action,
            color: '#fff',
            '&:hover': { backgroundColor: dark ? '#5379ff' : '#2343c7' },
          },
          outlined: {
            borderColor: line,
            '&:hover': { borderColor: accent, backgroundColor: alpha(accent, 0.06) },
          },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 5 } } },
      MuiToggleButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, borderColor: line, borderRadius: 4 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, minHeight: 46, fontSize: '0.8125rem' },
        },
      },
      MuiTabs: { styleOverrides: { indicator: { height: 2 } } },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, fontWeight: 600 },
          sizeSmall: { fontSize: '0.6875rem' },
        },
      },
      MuiDrawer: {
        styleOverrides: { paper: { backgroundColor: paper, borderInlineEnd: `1px solid ${line}` } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: paper,
            color: ink,
            backgroundImage: 'none',
            borderBottom: `1px solid ${line}`,
            boxShadow: 'none',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 5,
            marginInline: 8,
            '&.Mui-selected': {
              backgroundColor: alpha(accent, 0.13),
              color: accent,
              '&:hover': { backgroundColor: alpha(accent, 0.18) },
            },
          },
        },
      },
      MuiOutlinedInput: {
        defaultProps: { notched: true },
        styleOverrides: {
          root: { borderRadius: 5, backgroundColor: alpha(bg, 0.55) },
          notchedOutline: { borderColor: line },
        },
      },
      MuiInputLabel: { defaultProps: { shrink: true }, styleOverrides: { root: { color: muted } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: line },
          head: { color: muted, fontSize: '0.6875rem', letterSpacing: '0.04em', fontWeight: 700 },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { '&.MuiTableRow-hover:hover': { backgroundColor: alpha(accent, 0.04) } },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 9,
            backgroundImage: 'none',
            border: `1px solid ${line}`,
            boxShadow: `0 24px 90px ${alpha('#000', dark ? 0.5 : 0.15)}`,
          },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontWeight: 800, letterSpacing: '-0.025em' } } },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${line}`,
            boxShadow: `0 10px 40px ${alpha('#000', dark ? 0.35 : 0.12)}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: dark ? raised : '#14213b',
            color: '#f3f6ff',
            fontSize: '0.75rem',
          },
        },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: 5 } } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: line, borderRadius: 2 },
          bar: { borderRadius: 2 },
        },
      },
      MuiSkeleton: { styleOverrides: { root: { backgroundColor: raised } } },
      MuiLink: { styleOverrides: { root: { textUnderlineOffset: '3px' } } },
    },
  }
}
