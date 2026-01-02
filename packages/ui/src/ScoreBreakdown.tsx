import React from 'react'
import { Box, Typography, LinearProgress, Paper } from '@mui/material'

export interface ScoreItem {
  label: string
  value: number
  maxValue?: number
  color?: string
}

export interface ScoreBreakdownProps {
  title?: string
  finalScore: number
  scores: ScoreItem[]
  showPercentages?: boolean
}

export function ScoreBreakdown({
  title = 'Score Breakdown',
  finalScore,
  scores,
  showPercentages = true,
}: ScoreBreakdownProps) {
  const getColor = (index: number, customColor?: string) => {
    if (customColor) return customColor
    const colors = ['primary', 'secondary', 'success', 'warning', 'info']
    return colors[index % colors.length]
  }

  return (
    <Paper
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="h5" color="primary.main" fontWeight={700}>
          {(finalScore * 100).toFixed(0)}%
        </Typography>
      </Box>

      <Box>
        {scores.map((score, index) => {
          const maxValue = score.maxValue || 1
          const percentage = (score.value / maxValue) * 100
          const color = getColor(index, score.color)

          return (
            <Box key={score.label} mb={1.5}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {score.label}
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {showPercentages
                    ? `${percentage.toFixed(0)}%`
                    : score.value.toFixed(2)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(percentage, 100)}
                color={color as 'primary' | 'secondary' | 'success' | 'warning' | 'info'}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'grey.800',
                }}
              />
            </Box>
          )
        })}
      </Box>
    </Paper>
  )
}

