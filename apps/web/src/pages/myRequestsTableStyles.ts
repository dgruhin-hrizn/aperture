import type { Theme } from '@mui/material'

export const requestTableSx = (theme: Theme) => ({
  [theme.breakpoints.down('sm')]: {
    display: 'block',
    '& .MuiTableHead-root': {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
    },
    '& .MuiTableBody-root': { display: 'block' },
    '& .MuiTableBody-root .MuiTableRow-root': {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, max-content) minmax(0, 1fr) auto',
      gridTemplateAreas: '"title title status" "type source action" "date date action"',
      alignItems: 'center',
      columnGap: 1,
      rowGap: 0.25,
      p: 1,
      borderBottom: 1,
      borderColor: 'divider',
    },
    '& .MuiTableBody-root .MuiTableCell-root': {
      width: 'auto',
      minWidth: 0,
      p: 0,
      border: 0,
      overflowWrap: 'anywhere',
    },
    '& .MuiTableCell-root .MuiChip-root': { maxWidth: '100%' },
    '& .MuiTableCell-root:nth-of-type(1)': { gridArea: 'title' },
    '& .MuiTableCell-root:nth-of-type(2)': { gridArea: 'type' },
    '& .MuiTableCell-root:nth-of-type(3)': { gridArea: 'source' },
    '& .MuiTableCell-root:nth-of-type(4)': { gridArea: 'date' },
    '& .MuiTableCell-root:nth-of-type(5)': { gridArea: 'status', justifySelf: 'end' },
    '& .MuiTableCell-root:nth-of-type(6)': { gridArea: 'action', justifySelf: 'end' },
  },
})
