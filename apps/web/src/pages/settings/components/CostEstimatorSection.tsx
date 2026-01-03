import React, { useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
  TextField,
  Divider,
  Chip,
  Stack,
  Tooltip,
  IconButton,
  Alert,
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import PaymentsIcon from '@mui/icons-material/Payments'

interface CostEstimatorSectionProps {
  // Pass in the counts from database or estimates
  movieCount?: number
  seriesCount?: number
  episodeCount?: number
  enabledUserCount?: number
  // Config
  embeddingModel?: string
}

// OpenAI Pricing (as of 2024)
const PRICING = {
  'text-embedding-3-small': {
    perMillionTokens: 0.02,
    tokensPerItem: 400, // Average tokens per canonical text
  },
  'text-embedding-3-large': {
    perMillionTokens: 0.13,
    tokensPerItem: 400,
  },
  'gpt-4o-mini': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
  },
}

interface CostBreakdown {
  category: string
  description: string
  count: number
  tokensPerItem: number
  totalTokens: number
  costPerMillion: number
  totalCost: number
}

export function CostEstimatorSection({
  movieCount = 0,
  seriesCount = 0,
  episodeCount = 0,
  enabledUserCount = 1,
  embeddingModel = 'text-embedding-3-large',
}: CostEstimatorSectionProps) {
  const [movieRecCount, setMovieRecCount] = React.useState(25)
  const [seriesRecCount, setSeriesRecCount] = React.useState(12)
  const [runsPerWeek, setRunsPerWeek] = React.useState(1)

  // Embedding costs calculation
  const embeddingCosts = useMemo(() => {
    const model = embeddingModel === 'text-embedding-3-large' ? 'text-embedding-3-large' : 'text-embedding-3-small'
    const pricing = PRICING[model]

    const items: CostBreakdown[] = []

    // Movie embeddings (one-time)
    if (movieCount > 0) {
      const totalTokens = movieCount * pricing.tokensPerItem
      items.push({
        category: 'Movie Embeddings',
        description: 'Initial embedding generation for all movies',
        count: movieCount,
        tokensPerItem: pricing.tokensPerItem,
        totalTokens,
        costPerMillion: pricing.perMillionTokens,
        totalCost: (totalTokens / 1_000_000) * pricing.perMillionTokens,
      })
    }

    // Series embeddings (one-time)
    if (seriesCount > 0) {
      const totalTokens = seriesCount * (pricing.tokensPerItem * 1.2) // Series have slightly more text
      items.push({
        category: 'Series Embeddings',
        description: 'Initial embedding generation for all series',
        count: seriesCount,
        tokensPerItem: Math.round(pricing.tokensPerItem * 1.2),
        totalTokens,
        costPerMillion: pricing.perMillionTokens,
        totalCost: (totalTokens / 1_000_000) * pricing.perMillionTokens,
      })
    }

    // Episode embeddings (one-time)
    if (episodeCount > 0) {
      const totalTokens = episodeCount * (pricing.tokensPerItem * 0.6) // Episodes have less text
      items.push({
        category: 'Episode Embeddings',
        description: 'Initial embedding generation for all episodes',
        count: episodeCount,
        tokensPerItem: Math.round(pricing.tokensPerItem * 0.6),
        totalTokens,
        costPerMillion: pricing.perMillionTokens,
        totalCost: (totalTokens / 1_000_000) * pricing.perMillionTokens,
      })
    }

    return items
  }, [movieCount, seriesCount, episodeCount, embeddingModel])

  // Recurring costs calculation (per week)
  const recurringCosts = useMemo(() => {
    const items: CostBreakdown[] = []
    const gptPricing = PRICING['gpt-4o-mini']

    // Taste Synopsis Generation (once per week per user)
    const tasteSynopsisInputTokens = 1500 // Average input for taste synopsis
    const tasteSynopsisOutputTokens = 200 // Average output
    const tasteSynopsisUsers = enabledUserCount
    
    // Movie taste synopsis
    if (movieCount > 0) {
      const inputCost = (tasteSynopsisInputTokens * tasteSynopsisUsers * runsPerWeek / 1_000_000) * gptPricing.inputPerMillion
      const outputCost = (tasteSynopsisOutputTokens * tasteSynopsisUsers * runsPerWeek / 1_000_000) * gptPricing.outputPerMillion
      items.push({
        category: 'Movie Taste Synopsis',
        description: `AI taste profile for ${enabledUserCount} user(s)`,
        count: tasteSynopsisUsers * runsPerWeek,
        tokensPerItem: tasteSynopsisInputTokens + tasteSynopsisOutputTokens,
        totalTokens: (tasteSynopsisInputTokens + tasteSynopsisOutputTokens) * tasteSynopsisUsers * runsPerWeek,
        costPerMillion: (gptPricing.inputPerMillion + gptPricing.outputPerMillion) / 2,
        totalCost: inputCost + outputCost,
      })
    }

    // Series taste synopsis
    if (seriesCount > 0) {
      const inputCost = (tasteSynopsisInputTokens * tasteSynopsisUsers * runsPerWeek / 1_000_000) * gptPricing.inputPerMillion
      const outputCost = (tasteSynopsisOutputTokens * tasteSynopsisUsers * runsPerWeek / 1_000_000) * gptPricing.outputPerMillion
      items.push({
        category: 'Series Taste Synopsis',
        description: `AI taste profile for ${enabledUserCount} user(s)`,
        count: tasteSynopsisUsers * runsPerWeek,
        tokensPerItem: tasteSynopsisInputTokens + tasteSynopsisOutputTokens,
        totalTokens: (tasteSynopsisInputTokens + tasteSynopsisOutputTokens) * tasteSynopsisUsers * runsPerWeek,
        costPerMillion: (gptPricing.inputPerMillion + gptPricing.outputPerMillion) / 2,
        totalCost: inputCost + outputCost,
      })
    }

    // Movie Recommendation Explanations
    if (movieCount > 0 && movieRecCount > 0) {
      const inputTokensPerRec = 500 // Context per recommendation
      const outputTokensPerRec = 80 // Explanation output
      const totalRecs = movieRecCount * enabledUserCount * runsPerWeek
      const inputCost = (inputTokensPerRec * totalRecs / 1_000_000) * gptPricing.inputPerMillion
      const outputCost = (outputTokensPerRec * totalRecs / 1_000_000) * gptPricing.outputPerMillion
      items.push({
        category: 'Movie Explanations',
        description: `AI explanations for ${movieRecCount} movies × ${enabledUserCount} user(s)`,
        count: totalRecs,
        tokensPerItem: inputTokensPerRec + outputTokensPerRec,
        totalTokens: (inputTokensPerRec + outputTokensPerRec) * totalRecs,
        costPerMillion: (gptPricing.inputPerMillion + gptPricing.outputPerMillion) / 2,
        totalCost: inputCost + outputCost,
      })
    }

    // Series Recommendation Explanations
    if (seriesCount > 0 && seriesRecCount > 0) {
      const inputTokensPerRec = 600 // Slightly more context for series
      const outputTokensPerRec = 80
      const totalRecs = seriesRecCount * enabledUserCount * runsPerWeek
      const inputCost = (inputTokensPerRec * totalRecs / 1_000_000) * gptPricing.inputPerMillion
      const outputCost = (outputTokensPerRec * totalRecs / 1_000_000) * gptPricing.outputPerMillion
      items.push({
        category: 'Series Explanations',
        description: `AI explanations for ${seriesRecCount} series × ${enabledUserCount} user(s)`,
        count: totalRecs,
        tokensPerItem: inputTokensPerRec + outputTokensPerRec,
        totalTokens: (inputTokensPerRec + outputTokensPerRec) * totalRecs,
        costPerMillion: (gptPricing.inputPerMillion + gptPricing.outputPerMillion) / 2,
        totalCost: inputCost + outputCost,
      })
    }

    return items
  }, [movieCount, seriesCount, enabledUserCount, movieRecCount, seriesRecCount, runsPerWeek])

  const totalOneTimeCost = embeddingCosts.reduce((sum, item) => sum + item.totalCost, 0)
  const totalWeeklyCost = recurringCosts.reduce((sum, item) => sum + item.totalCost, 0)
  const totalMonthlyCost = totalWeeklyCost * 4.33

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <PaymentsIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Cost Estimator
        </Typography>
        <Tooltip title="Estimates based on OpenAI pricing. Actual costs may vary based on text length and API usage.">
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        These are estimates based on current OpenAI pricing. Using <strong>{embeddingModel}</strong> for embeddings
        and <strong>gpt-4o-mini</strong> for explanations.
      </Alert>

      {/* Configuration Sliders */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Configure Recommendations
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
          <Box>
            <Typography variant="body2" gutterBottom>
              Movie Recommendations per User: <strong>{movieRecCount}</strong>
            </Typography>
            <Slider
              value={movieRecCount}
              onChange={(_, v) => setMovieRecCount(v as number)}
              min={5}
              max={50}
              step={5}
              marks={[{ value: 5, label: '5' }, { value: 25, label: '25' }, { value: 50, label: '50' }]}
            />
          </Box>
          <Box>
            <Typography variant="body2" gutterBottom>
              Series Recommendations per User: <strong>{seriesRecCount}</strong>
            </Typography>
            <Slider
              value={seriesRecCount}
              onChange={(_, v) => setSeriesRecCount(v as number)}
              min={3}
              max={24}
              step={3}
              marks={[{ value: 3, label: '3' }, { value: 12, label: '12' }, { value: 24, label: '24' }]}
            />
          </Box>
          <Box>
            <Typography variant="body2" gutterBottom>
              Recommendation Runs per Week: <strong>{runsPerWeek}</strong>
            </Typography>
            <Slider
              value={runsPerWeek}
              onChange={(_, v) => setRunsPerWeek(v as number)}
              min={1}
              max={7}
              step={1}
              marks={[{ value: 1, label: '1' }, { value: 7, label: 'Daily' }]}
            />
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* One-Time Costs */}
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        One-Time Embedding Costs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Initial cost to generate embeddings for your library. Only needed once (unless you add new content).
      </Typography>

      <TableContainer sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="right">Items</TableCell>
              <TableCell align="right">Tokens</TableCell>
              <TableCell align="right">Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {embeddingCosts.map((item) => (
              <TableRow key={item.category}>
                <TableCell>
                  <Typography variant="body2">{item.category}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                </TableCell>
                <TableCell align="right">{item.count.toLocaleString()}</TableCell>
                <TableCell align="right">{item.totalTokens.toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={500}>
                    ${item.totalCost.toFixed(4)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3}>
                <Typography variant="body2" fontWeight={600}>
                  Total One-Time Cost
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Chip
                  label={`$${totalOneTimeCost.toFixed(2)}`}
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Recurring Costs */}
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Recurring Weekly Costs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Ongoing costs for generating taste profiles and recommendation explanations.
      </Typography>

      <TableContainer sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell align="right">Calls/Week</TableCell>
              <TableCell align="right">Tokens</TableCell>
              <TableCell align="right">Cost/Week</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recurringCosts.map((item) => (
              <TableRow key={item.category}>
                <TableCell>
                  <Typography variant="body2">{item.category}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                </TableCell>
                <TableCell align="right">{item.count.toLocaleString()}</TableCell>
                <TableCell align="right">{item.totalTokens.toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={500}>
                    ${item.totalCost.toFixed(4)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3}>
                <Typography variant="body2" fontWeight={600}>
                  Total Weekly Cost
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Chip
                  label={`$${totalWeeklyCost.toFixed(4)}`}
                  color="secondary"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Summary */}
      <Paper
        sx={{
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 2,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="space-around">
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Initial Setup
            </Typography>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              ${totalOneTimeCost.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              one-time
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Per User Weekly
            </Typography>
            <Typography variant="h5" fontWeight={700} color="secondary.main">
              ${(totalWeeklyCost / enabledUserCount).toFixed(4)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              per week
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Monthly Estimate
            </Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">
              ${totalMonthlyCost.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              for {enabledUserCount} user(s)
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Paper>
  )
}

