import { Box, Chip, Typography, alpha, useTheme } from '@mui/material'

interface ChipToggleGroupProps {
  label: string
  options: { value: string; label: string; count?: number }[]
  selected: string[]
  onChange: (selected: string[]) => void
  exclusive?: boolean
}

export function ChipToggleGroup({
  label,
  options,
  selected,
  onChange,
  exclusive = false,
}: ChipToggleGroupProps) {
  const theme = useTheme()

  const handleToggle = (value: string) => {
    if (exclusive) {
      // Single select mode - toggle off if already selected, otherwise select this one
      onChange(selected.includes(value) ? [] : [value])
    } else {
      // Multi-select mode
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value))
      } else {
        onChange([...selected, value])
      }
    }
  }

  return (
    <Box>
      <Typography variant="body2" fontWeight={500} mb={1}>
        {label}
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={0.75}>
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <Chip
              key={option.value}
              label={option.count !== undefined ? `${option.label} (${option.count})` : option.label}
              onClick={() => handleToggle(option.value)}
              variant={isSelected ? 'filled' : 'outlined'}
              size="small"
              sx={{
                cursor: 'pointer',
                fontWeight: isSelected ? 600 : 400,
                backgroundColor: isSelected
                  ? alpha(theme.palette.primary.main, 0.15)
                  : 'transparent',
                borderColor: isSelected ? 'primary.main' : 'divider',
                color: isSelected ? 'primary.main' : 'text.primary',
                '&:hover': {
                  backgroundColor: isSelected
                    ? alpha(theme.palette.primary.main, 0.25)
                    : alpha(theme.palette.action.hover, 0.08),
                  borderColor: isSelected ? 'primary.main' : 'text.secondary',
                },
                transition: 'all 0.15s ease',
              }}
            />
          )
        })}
      </Box>
    </Box>
  )
}
