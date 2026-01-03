import React, { useMemo, useState, useEffect } from 'react'
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
  Divider,
  Chip,
  Stack,
  Tooltip,
  IconButton,
  Alert,
  Card,
  CardContent,
  CircularProgress,
  Link,
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import PaymentsIcon from '@mui/icons-material/Payments'
import StorageIcon from '@mui/icons-material/Storage'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LinkIcon from '@mui/icons-material/Link'

interface CostEstimatorSectionProps {
  movieCount?: number
  seriesCount?: number
  episodeCount?: number
  enabledUserCount?: number
  embeddingModel?: string
}

// OpenAI Pricing
const EMBEDDING_PRICING = {
  'text-embedding-3-small': { perMillionTokens: 0.02, tokensPerItem: 400 },
  'text-embedding-3-large': { perMillionTokens: 0.13, tokensPerItem: 400 },
}

interface CostInputs {
  movie: {
    selectedCount: number
    runsPerWeek: number
    schedule: string
    enabledUsers: number
    source: {
      selectedCount: string
      schedule: string
    }
  }
  series: {
    selectedCount: number
    runsPerWeek: number
    schedule: string
    enabledUsers: number
    source: {
      selectedCount: string
      schedule: string
    }
  }
}

interface TextGenModel {
  id: string
  inputCostPerMillion: number
  outputCostPerMillion: number
}

export function CostEstimatorSection({
  movieCount = 0,
  seriesCount = 0,
  episodeCount = 0,
  embeddingModel = 'text-embedding-3-large',
}: CostEstimatorSectionProps) {
  const [costInputs, setCostInputs] = useState<CostInputs | null>(null)
  const [textGenModel, setTextGenModel] = useState<TextGenModel | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch cost inputs and text generation model
  useEffect(() => {
    Promise.all([
      fetch('/api/settings/cost-inputs', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/settings/text-generation-model', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([inputs, textGen]) => {
        setCostInputs(inputs)
        const current = textGen.availableModels?.find((m: TextGenModel) => m.id === textGen.currentModel)
        if (current) {
          setTextGenModel(current)
        }
      })
      .catch(() => {
        // Fallback defaults
        setCostInputs({
          movie: {
            selectedCount: 25,
            runsPerWeek: 7,
            schedule: 'Daily at 4:00 AM',
            enabledUsers: 1,
            source: {
              selectedCount: 'Settings > AI Config > Algorithm > Movies',
              schedule: 'Jobs > generate-recommendations',
            },
          },
          series: {
            selectedCount: 12,
            runsPerWeek: 7,
            schedule: 'Daily at 4:00 AM',
            enabledUsers: 1,
            source: {
              selectedCount: 'Settings > AI Config > Algorithm > Series',
              schedule: 'Jobs > generate-series-recommendations',
            },
          },
        })
        setTextGenModel({ id: 'gpt-4o-mini', inputCostPerMillion: 0.15, outputCostPerMillion: 0.6 })
      })
      .finally(() => setLoading(false))
  }, [])

  // One-time embedding costs
  const embeddingCosts = useMemo(() => {
    const model = embeddingModel === 'text-embedding-3-large' ? 'text-embedding-3-large' : 'text-embedding-3-small'
    const pricing = EMBEDDING_PRICING[model]
    const items: Array<{ category: string; count: number; tokens: number; cost: number }> = []

    if (movieCount > 0) {
      const tokens = movieCount * pricing.tokensPerItem
      items.push({
        category: 'Movies',
        count: movieCount,
        tokens,
        cost: (tokens / 1_000_000) * pricing.perMillionTokens,
      })
    }

    if (seriesCount > 0) {
      const tokens = seriesCount * Math.round(pricing.tokensPerItem * 1.2)
      items.push({
        category: 'Series',
        count: seriesCount,
        tokens,
        cost: (tokens / 1_000_000) * pricing.perMillionTokens,
      })
    }

    if (episodeCount > 0) {
      const tokens = episodeCount * Math.round(pricing.tokensPerItem * 0.6)
      items.push({
        category: 'Episodes',
        count: episodeCount,
        tokens,
        cost: (tokens / 1_000_000) * pricing.perMillionTokens,
      })
    }

    return items
  }, [movieCount, seriesCount, episodeCount, embeddingModel])

  // Recurring text generation costs
  const recurringCosts = useMemo(() => {
    if (!textGenModel || !costInputs) return []

    const items: Array<{ category: string; calls: number; tokens: number; cost: number }> = []
    const { inputCostPerMillion, outputCostPerMillion } = textGenModel

    // Movie costs
    if (costInputs.movie.enabledUsers > 0 && costInputs.movie.runsPerWeek > 0) {
      // Taste synopsis
      const tasteCalls = costInputs.movie.enabledUsers * costInputs.movie.runsPerWeek
      const tasteInput = 1500 * tasteCalls
      const tasteOutput = 200 * tasteCalls
      items.push({
        category: 'Movie Taste Synopses',
        calls: tasteCalls,
        tokens: tasteInput + tasteOutput,
        cost: (tasteInput / 1_000_000) * inputCostPerMillion + (tasteOutput / 1_000_000) * outputCostPerMillion,
      })

      // Explanations
      const expCalls = costInputs.movie.selectedCount * costInputs.movie.enabledUsers * costInputs.movie.runsPerWeek
      const expInput = 500 * expCalls
      const expOutput = 80 * expCalls
      items.push({
        category: 'Movie Explanations',
        calls: expCalls,
        tokens: expInput + expOutput,
        cost: (expInput / 1_000_000) * inputCostPerMillion + (expOutput / 1_000_000) * outputCostPerMillion,
      })
    }

    // Series costs
    if (costInputs.series.enabledUsers > 0 && costInputs.series.runsPerWeek > 0) {
      // Taste synopsis
      const tasteCalls = costInputs.series.enabledUsers * costInputs.series.runsPerWeek
      const tasteInput = 1500 * tasteCalls
      const tasteOutput = 200 * tasteCalls
      items.push({
        category: 'Series Taste Synopses',
        calls: tasteCalls,
        tokens: tasteInput + tasteOutput,
        cost: (tasteInput / 1_000_000) * inputCostPerMillion + (tasteOutput / 1_000_000) * outputCostPerMillion,
      })

      // Explanations
      const expCalls = costInputs.series.selectedCount * costInputs.series.enabledUsers * costInputs.series.runsPerWeek
      const expInput = 600 * expCalls
      const expOutput = 80 * expCalls
      items.push({
        category: 'Series Explanations',
        calls: expCalls,
        tokens: expInput + expOutput,
        cost: (expInput / 1_000_000) * inputCostPerMillion + (expOutput / 1_000_000) * outputCostPerMillion,
      })
    }

    return items
  }, [costInputs, textGenModel])

  const totalOneTimeCost = embeddingCosts.reduce((sum, item) => sum + item.cost, 0)
  const totalWeeklyCost = recurringCosts.reduce((sum, item) => sum + item.cost, 0)
  const totalMonthlyCost = totalWeeklyCost * 4.33
  const totalEnabledUsers = Math.max(costInputs?.movie.enabledUsers ?? 0, costInputs?.series.enabledUsers ?? 0, 1)

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Loading cost data...
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PaymentsIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Cost Estimator
        </Typography>
        <Tooltip title="Estimates based on OpenAI pricing. Actual costs may vary.">
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Configuration Info Card */}
      {costInputs && (
        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'action.hover' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Configuration (from your settings)
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {/* Movies */}
              <Box>
                <Typography variant="body2">
                  <strong>Movie Recs:</strong> {costInputs.movie.selectedCount} per user
                </Typography>
                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <LinkIcon sx={{ fontSize: 12 }} /> {costInputs.movie.source.selectedCount}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Movie Runs:</strong> {costInputs.movie.runsPerWeek}/week ({costInputs.movie.schedule})
                </Typography>
                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <LinkIcon sx={{ fontSize: 12 }} /> {costInputs.movie.source.schedule}
                </Typography>
              </Box>
              {/* Series */}
              <Box>
                <Typography variant="body2">
                  <strong>Series Recs:</strong> {costInputs.series.selectedCount} per user
                </Typography>
                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <LinkIcon sx={{ fontSize: 12 }} /> {costInputs.series.source.selectedCount}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Series Runs:</strong> {costInputs.series.runsPerWeek}/week ({costInputs.series.schedule})
                </Typography>
                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <LinkIcon sx={{ fontSize: 12 }} /> {costInputs.series.source.schedule}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout for Cost Sections */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* One-Time Costs */}
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <StorageIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={600}>
                One-Time Costs
              </Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
              <Typography variant="caption">
                Embeddings using <strong>text-embedding-3-large</strong>
              </Typography>
            </Alert>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {embeddingCosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                          No items to embed
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    embeddingCosts.map((item) => (
                      <TableRow key={item.category}>
                        <TableCell>{item.category}</TableCell>
                        <TableCell align="right">{item.count.toLocaleString()}</TableCell>
                        <TableCell align="right">${item.cost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="body2" fontWeight={600}>Total</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={`$${totalOneTimeCost.toFixed(2)}`} color="primary" size="small" sx={{ fontWeight: 600 }} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Recurring Costs */}
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AutoAwesomeIcon color="secondary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={600}>
                Recurring Costs
              </Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
              <Typography variant="caption">
                Text generation using <strong>{textGenModel?.id || 'gpt-4o-mini'}</strong>
              </Typography>
            </Alert>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Calls/Wk</TableCell>
                    <TableCell align="right">Cost/Wk</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recurringCosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                          No recurring costs
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    recurringCosts.map((item) => (
                      <TableRow key={item.category}>
                        <TableCell>{item.category}</TableCell>
                        <TableCell align="right">{item.calls.toLocaleString()}</TableCell>
                        <TableCell align="right">${item.cost.toFixed(4)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="body2" fontWeight={600}>Total Weekly</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={`$${totalWeeklyCost.toFixed(4)}`} color="secondary" size="small" sx={{ fontWeight: 600 }} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>

      {/* Summary */}
      <Paper sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="space-around">
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Initial Setup</Typography>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              ${totalOneTimeCost.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">one-time</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Weekly</Typography>
            <Typography variant="h5" fontWeight={700} color="secondary.main">
              ${totalWeeklyCost.toFixed(4)}
            </Typography>
            <Typography variant="caption" color="text.secondary">for {totalEnabledUsers} user(s)</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Monthly Est.</Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">
              ${totalMonthlyCost.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">~4.33 weeks</Typography>
          </Box>
        </Stack>
      </Paper>
    </Paper>
  )
}
