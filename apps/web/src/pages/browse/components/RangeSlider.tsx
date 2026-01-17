import { Box, Slider, Typography, alpha, useTheme } from '@mui/material'

interface RangeSliderProps {
  label: string
  value: [number, number]
  onChange: (value: [number, number]) => void
  min: number
  max: number
  step?: number
  formatValue?: (value: number) => string
  marks?: boolean | { value: number; label: string }[]
}

export function RangeSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue = (v) => String(v),
  marks = false,
}: RangeSliderProps) {
  const theme = useTheme()
  const isChanged = value[0] !== min || value[1] !== max

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant="body2" fontWeight={500}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: isChanged ? 'primary.main' : 'text.secondary',
            fontWeight: isChanged ? 600 : 400,
          }}
        >
          {formatValue(value[0])} – {formatValue(value[1])}
        </Typography>
      </Box>
      <Slider
        value={value}
        onChange={(_, newValue) => onChange(newValue as [number, number])}
        min={min}
        max={max}
        step={step}
        marks={marks}
        valueLabelDisplay="auto"
        valueLabelFormat={formatValue}
        sx={{
          '& .MuiSlider-thumb': {
            width: 16,
            height: 16,
            backgroundColor: 'background.paper',
            border: '2px solid',
            borderColor: 'primary.main',
            '&:hover, &.Mui-focusVisible': {
              boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`,
            },
          },
          '& .MuiSlider-track': {
            height: 4,
            borderRadius: 2,
          },
          '& .MuiSlider-rail': {
            height: 4,
            borderRadius: 2,
            opacity: 0.3,
          },
        }}
      />
    </Box>
  )
}
