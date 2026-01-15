import React, { useMemo, useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Tooltip,
  IconButton,
  Alert,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import PaymentsIcon from '@mui/icons-material/Payments'
import StorageIcon from '@mui/icons-material/Storage'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ChatIcon from '@mui/icons-material/Chat'
import ComputerIcon from '@mui/icons-material/Computer'
import CloudIcon from '@mui/icons-material/Cloud'

// ============================================================================
// Types
// ============================================================================

interface FunctionPricing {
  provider: string
  providerName: string
  model: string
  modelName: string
  isLocalProvider: boolean
  inputCostPerMillion: number
  outputCostPerMillion: number
  embeddingDimensions?: number
}

interface AIPricing {
  embeddings: FunctionPricing | null
  chat: FunctionPricing | null
  textGeneration: FunctionPricing | null
}

interface UserEstimates {
  weeklyMoviesAdded: number
  weeklyShowsAdded: number
  weeklyEpisodesAdded: number
  weeklyChatMessagesPerUser: number
}

interface CostInputs {
  movie: {
    selectedCount: number
    runsPerWeek: number
    schedule: string
    enabledUsers: number
  }
  series: {
    selectedCount: number
    runsPerWeek: number
    schedule: string
    enabledUsers: number
  }
  embeddings?: {
    movie: {
      runsPerWeek: number
      schedule: string
      pendingItems: number
    }
    series: {
      runsPerWeek: number
      schedule: string
      pendingItems: number
      pendingEpisodes: number
    }
  }
  assistant?: {
    runsPerWeek: number
    schedule: string
    enabledUsers: number
  }
  library: {
    totalMovies: number
    totalSeries: number
    totalEpisodes: number
  }
  userEstimates: UserEstimates
}

// Token estimates per item type
const TOKENS_PER_MOVIE = 400
const TOKENS_PER_SERIES = 480 // Movies * 1.2
const TOKENS_PER_EPISODE = 240 // Movies * 0.6

// Text generation token estimates
const TEXT_GEN = {
  tasteSynopsis: { input: 1500, output: 200 },
  explanation: { input: 500, output: 80 },
  seriesExplanation: { input: 600, output: 80 },
  suggestion: { input: 300, output: 50 },
  chatMessage: { input: 2000, output: 500 },
}

// ============================================================================
// Component
// ============================================================================

export function CostEstimatorSection() {
  const [costInputs, setCostInputs] = useState<CostInputs | null>(null)
  const [pricing, setPricing] = useState<AIPricing | null>(null)
  const [loading, setLoading] = useState(true)
  const [userEstimates, setUserEstimates] = useState<UserEstimates>({
    weeklyMoviesAdded: 5,
    weeklyShowsAdded: 3,
    weeklyEpisodesAdded: 20,
    weeklyChatMessagesPerUser: 50,
  })
  const [savingEstimates, setSavingEstimates] = useState(false)

  // Fetch cost inputs and pricing
  useEffect(() => {
    Promise.all([
      fetch('/api/settings/cost-inputs', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/settings/ai/pricing', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([inputs, aiPricing]) => {
        setCostInputs(inputs)
        setPricing(aiPricing)
        if (inputs.userEstimates) {
          setUserEstimates(inputs.userEstimates)
        }
      })
      .catch((err) => {
        console.error('Failed to load cost estimation data:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  // Debounced save of user estimates
  const saveUserEstimates = useCallback(async (estimates: UserEstimates) => {
    setSavingEstimates(true)
    try {
      await fetch('/api/settings/cost-inputs/estimates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(estimates),
      })
    } catch (err) {
      console.error('Failed to save user estimates:', err)
    } finally {
      setSavingEstimates(false)
    }
  }, [])

  // Handle estimate change with debounce
  const handleEstimateChange = useCallback(
    (field: keyof UserEstimates) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(0, parseInt(e.target.value, 10) || 0)
      const newEstimates = { ...userEstimates, [field]: value }
      setUserEstimates(newEstimates)
      // Debounce the save
      const timeout = setTimeout(() => saveUserEstimates(newEstimates), 1000)
      return () => clearTimeout(timeout)
    },
    [userEstimates, saveUserEstimates]
  )

  // Calculate embedding cost for a given number of items and tokens
  const calculateEmbeddingCost = useCallback(
    (items: number, tokensPerItem: number): number => {
      if (!pricing?.embeddings || pricing.embeddings.isLocalProvider) return 0
      const tokens = items * tokensPerItem
      return (tokens / 1_000_000) * pricing.embeddings.inputCostPerMillion
    },
    [pricing]
  )

  // Calculate text generation cost
  const calculateTextGenCost = useCallback(
    (calls: number, inputTokensPerCall: number, outputTokensPerCall: number): number => {
      if (!pricing?.textGeneration || pricing.textGeneration.isLocalProvider) return 0
      const inputTokens = calls * inputTokensPerCall
      const outputTokens = calls * outputTokensPerCall
      return (
        (inputTokens / 1_000_000) * pricing.textGeneration.inputCostPerMillion +
        (outputTokens / 1_000_000) * pricing.textGeneration.outputCostPerMillion
      )
    },
    [pricing]
  )

  // Calculate chat cost
  const calculateChatCost = useCallback(
    (messages: number): number => {
      if (!pricing?.chat || pricing.chat.isLocalProvider) return 0
      return (
        (messages * TEXT_GEN.chatMessage.input / 1_000_000) * pricing.chat.inputCostPerMillion +
        (messages * TEXT_GEN.chatMessage.output / 1_000_000) * pricing.chat.outputCostPerMillion
      )
    },
    [pricing]
  )

  // One-time embedding costs (initial library)
  const oneTimeCosts = useMemo(() => {
    if (!costInputs?.library || !pricing?.embeddings) return []

    const items: Array<{ category: string; count: number; cost: number }> = []

    if (costInputs.library.totalMovies > 0) {
      items.push({
        category: 'Movies',
        count: costInputs.library.totalMovies,
        cost: calculateEmbeddingCost(costInputs.library.totalMovies, TOKENS_PER_MOVIE),
      })
    }

    if (costInputs.library.totalSeries > 0) {
      items.push({
        category: 'Series',
        count: costInputs.library.totalSeries,
        cost: calculateEmbeddingCost(costInputs.library.totalSeries, TOKENS_PER_SERIES),
      })
    }

    if (costInputs.library.totalEpisodes > 0) {
      items.push({
        category: 'Episodes',
        count: costInputs.library.totalEpisodes,
        cost: calculateEmbeddingCost(costInputs.library.totalEpisodes, TOKENS_PER_EPISODE),
      })
    }

    return items
  }, [costInputs, pricing, calculateEmbeddingCost])

  // Recurring weekly embedding costs (new content)
  const weeklyEmbeddingCosts = useMemo(() => {
    if (!pricing?.embeddings) return []

    const items: Array<{ category: string; count: number; cost: number }> = []

    if (userEstimates.weeklyMoviesAdded > 0) {
      items.push({
        category: 'New Movies',
        count: userEstimates.weeklyMoviesAdded,
        cost: calculateEmbeddingCost(userEstimates.weeklyMoviesAdded, TOKENS_PER_MOVIE),
      })
    }

    if (userEstimates.weeklyShowsAdded > 0) {
      items.push({
        category: 'New Shows',
        count: userEstimates.weeklyShowsAdded,
        cost: calculateEmbeddingCost(userEstimates.weeklyShowsAdded, TOKENS_PER_SERIES),
      })
    }

    if (userEstimates.weeklyEpisodesAdded > 0) {
      items.push({
        category: 'New Episodes',
        count: userEstimates.weeklyEpisodesAdded,
        cost: calculateEmbeddingCost(userEstimates.weeklyEpisodesAdded, TOKENS_PER_EPISODE),
      })
    }

    return items
  }, [pricing, userEstimates, calculateEmbeddingCost])

  // Recurring text generation costs
  const weeklyTextGenCosts = useMemo(() => {
    if (!costInputs || !pricing?.textGeneration) return []

    const items: Array<{ category: string; calls: number; cost: number }> = []

    // Movie taste synopses
    if (costInputs.movie.enabledUsers > 0 && costInputs.movie.runsPerWeek > 0) {
      const tasteCalls = costInputs.movie.enabledUsers * costInputs.movie.runsPerWeek
      items.push({
        category: 'Movie Taste Synopses',
        calls: tasteCalls,
        cost: calculateTextGenCost(tasteCalls, TEXT_GEN.tasteSynopsis.input, TEXT_GEN.tasteSynopsis.output),
      })

      // Movie explanations
      const expCalls = costInputs.movie.selectedCount * costInputs.movie.enabledUsers * costInputs.movie.runsPerWeek
      items.push({
        category: 'Movie Explanations',
        calls: expCalls,
        cost: calculateTextGenCost(expCalls, TEXT_GEN.explanation.input, TEXT_GEN.explanation.output),
      })
    }

    // Series taste synopses
    if (costInputs.series.enabledUsers > 0 && costInputs.series.runsPerWeek > 0) {
      const tasteCalls = costInputs.series.enabledUsers * costInputs.series.runsPerWeek
      items.push({
        category: 'Series Taste Synopses',
        calls: tasteCalls,
        cost: calculateTextGenCost(tasteCalls, TEXT_GEN.tasteSynopsis.input, TEXT_GEN.tasteSynopsis.output),
      })

      // Series explanations
      const expCalls = costInputs.series.selectedCount * costInputs.series.enabledUsers * costInputs.series.runsPerWeek
      items.push({
        category: 'Series Explanations',
        calls: expCalls,
        cost: calculateTextGenCost(expCalls, TEXT_GEN.seriesExplanation.input, TEXT_GEN.seriesExplanation.output),
      })
    }

    // Assistant suggestions
    if (costInputs.assistant && costInputs.assistant.enabledUsers > 0 && costInputs.assistant.runsPerWeek > 0) {
      const suggestionCalls = 5 * costInputs.assistant.enabledUsers * costInputs.assistant.runsPerWeek
      items.push({
        category: 'Assistant Suggestions',
        calls: suggestionCalls,
        cost: calculateTextGenCost(suggestionCalls, TEXT_GEN.suggestion.input, TEXT_GEN.suggestion.output),
      })
    }

    return items
  }, [costInputs, pricing, calculateTextGenCost])

  // Weekly chat costs
  const weeklyChatCost = useMemo(() => {
    if (!costInputs || !pricing?.chat) return 0
    const totalUsers = Math.max(costInputs.movie.enabledUsers, costInputs.series.enabledUsers, 1)
    const totalMessages = userEstimates.weeklyChatMessagesPerUser * totalUsers
    return calculateChatCost(totalMessages)
  }, [costInputs, pricing, userEstimates, calculateChatCost])

  // Totals
  const totalOneTimeCost = oneTimeCosts.reduce((sum, item) => sum + item.cost, 0)
  const totalWeeklyEmbeddingCost = weeklyEmbeddingCosts.reduce((sum, item) => sum + item.cost, 0)
  const totalWeeklyTextGenCost = weeklyTextGenCosts.reduce((sum, item) => sum + item.cost, 0)
  const totalWeeklyCost = totalWeeklyEmbeddingCost + totalWeeklyTextGenCost + weeklyChatCost
  const totalMonthlyCost = totalWeeklyCost * 4.33

  const totalEnabledUsers = costInputs
    ? Math.max(costInputs.movie.enabledUsers, costInputs.series.enabledUsers, 1)
    : 1

  const isAnyLocalProvider =
    pricing?.embeddings?.isLocalProvider ||
    pricing?.chat?.isLocalProvider ||
    pricing?.textGeneration?.isLocalProvider

  // Loading state
  if (loading) {
    return (
      <Card sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Loading cost data...
        </Typography>
      </Card>
    )
  }

  // No pricing configured
  if (!pricing || (!pricing.embeddings && !pricing.chat && !pricing.textGeneration)) {
    return (
      <Card sx={{ p: 3 }}>
        <Alert severity="info">
          Configure your AI providers above to see cost estimates.
        </Alert>
      </Card>
    )
  }

  return (
    <Card sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PaymentsIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Cost Estimator
        </Typography>
        <Tooltip title="Estimates based on your configured providers. Actual costs may vary.">
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {savingEstimates && <CircularProgress size={16} />}
      </Box>

      {/* Provider Configuration Summary */}
      <Card variant="outlined" sx={{ mb: 3, bgcolor: 'action.hover' }}>
        <CardContent sx={{ py: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Your AI Configuration
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {pricing.embeddings && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pricing.embeddings.isLocalProvider ? (
                  <ComputerIcon fontSize="small" color="success" />
                ) : (
                  <CloudIcon fontSize="small" color="primary" />
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Embeddings
                  </Typography>
                  <Typography variant="body2">
                    {pricing.embeddings.providerName} / {pricing.embeddings.modelName}
                  </Typography>
                  <Typography variant="caption" color={pricing.embeddings.isLocalProvider ? 'success.main' : 'text.secondary'}>
                    {pricing.embeddings.isLocalProvider
                      ? '$0.00 (Local)'
                      : `$${pricing.embeddings.inputCostPerMillion}/M tokens`}
                  </Typography>
                </Box>
              </Box>
            )}
            {pricing.textGeneration && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pricing.textGeneration.isLocalProvider ? (
                  <ComputerIcon fontSize="small" color="success" />
                ) : (
                  <CloudIcon fontSize="small" color="primary" />
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Text Generation
                  </Typography>
                  <Typography variant="body2">
                    {pricing.textGeneration.providerName} / {pricing.textGeneration.modelName}
                  </Typography>
                  <Typography variant="caption" color={pricing.textGeneration.isLocalProvider ? 'success.main' : 'text.secondary'}>
                    {pricing.textGeneration.isLocalProvider
                      ? '$0.00 (Local)'
                      : `$${pricing.textGeneration.inputCostPerMillion}/$${pricing.textGeneration.outputCostPerMillion}/M tokens`}
                  </Typography>
                </Box>
              </Box>
            )}
            {pricing.chat && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pricing.chat.isLocalProvider ? (
                  <ComputerIcon fontSize="small" color="success" />
                ) : (
                  <CloudIcon fontSize="small" color="primary" />
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Chat
                  </Typography>
                  <Typography variant="body2">
                    {pricing.chat.providerName} / {pricing.chat.modelName}
                  </Typography>
                  <Typography variant="caption" color={pricing.chat.isLocalProvider ? 'success.main' : 'text.secondary'}>
                    {pricing.chat.isLocalProvider
                      ? '$0.00 (Local)'
                      : `$${pricing.chat.inputCostPerMillion}/$${pricing.chat.outputCostPerMillion}/M tokens`}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* User Estimates Input */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Weekly Content Growth (Estimated)
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Movies/week"
              type="number"
              size="small"
              value={userEstimates.weeklyMoviesAdded}
              onChange={handleEstimateChange('weeklyMoviesAdded')}
              InputProps={{ inputProps: { min: 0 } }}
            />
            <TextField
              label="Shows/week"
              type="number"
              size="small"
              value={userEstimates.weeklyShowsAdded}
              onChange={handleEstimateChange('weeklyShowsAdded')}
              InputProps={{ inputProps: { min: 0 } }}
            />
            <TextField
              label="Episodes/week"
              type="number"
              size="small"
              value={userEstimates.weeklyEpisodesAdded}
              onChange={handleEstimateChange('weeklyEpisodesAdded')}
              InputProps={{ inputProps: { min: 0 } }}
            />
            <TextField
              label="Chat msgs/user/wk"
              type="number"
              size="small"
              value={userEstimates.weeklyChatMessagesPerUser}
              onChange={handleEstimateChange('weeklyChatMessagesPerUser')}
              InputProps={{ inputProps: { min: 0 } }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Local Provider Note */}
      {isAnyLocalProvider && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Self-hosted models detected!</strong> Running AI locally means $0.00 API costs for those functions.
            Only your compute costs (electricity, hardware) apply.
          </Typography>
        </Alert>
      )}

      {/* Cost Breakdown */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* One-Time Costs */}
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <StorageIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={600}>
                Initial Embedding Costs
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              One-time cost to embed your entire library ({costInputs?.library.totalMovies.toLocaleString()} movies,{' '}
              {costInputs?.library.totalSeries.toLocaleString()} series, {costInputs?.library.totalEpisodes.toLocaleString()} episodes)
            </Typography>

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
                  {oneTimeCosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                          No embeddings configured
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    oneTimeCosts.map((item) => (
                      <TableRow key={item.category}>
                        <TableCell>{item.category}</TableCell>
                        <TableCell align="right">{item.count.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          {pricing?.embeddings?.isLocalProvider ? (
                            <Chip label="Local" size="small" color="success" variant="outlined" />
                          ) : (
                            `$${item.cost.toFixed(2)}`
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="body2" fontWeight={600}>
                        Total
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={pricing?.embeddings?.isLocalProvider ? '$0.00' : `$${totalOneTimeCost.toFixed(2)}`}
                        color={pricing?.embeddings?.isLocalProvider ? 'success' : 'primary'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
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
                Weekly Recurring Costs
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Ongoing costs for recommendations, explanations, and chat
            </Typography>

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
                  {/* Weekly embedding costs */}
                  {weeklyEmbeddingCosts.map((item) => (
                    <TableRow key={item.category}>
                      <TableCell>{item.category}</TableCell>
                      <TableCell align="right">{item.count}</TableCell>
                      <TableCell align="right">
                        {pricing?.embeddings?.isLocalProvider ? (
                          <Chip label="Local" size="small" color="success" variant="outlined" />
                        ) : (
                          `$${item.cost.toFixed(4)}`
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Text generation costs */}
                  {weeklyTextGenCosts.map((item) => (
                    <TableRow key={item.category}>
                      <TableCell>{item.category}</TableCell>
                      <TableCell align="right">{item.calls.toLocaleString()}</TableCell>
                      <TableCell align="right">
                        {pricing?.textGeneration?.isLocalProvider ? (
                          <Chip label="Local" size="small" color="success" variant="outlined" />
                        ) : (
                          `$${item.cost.toFixed(4)}`
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Chat costs */}
                  {pricing?.chat && (
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ChatIcon fontSize="small" />
                          Chat Assistant
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {userEstimates.weeklyChatMessagesPerUser * totalEnabledUsers} msgs
                      </TableCell>
                      <TableCell align="right">
                        {pricing.chat.isLocalProvider ? (
                          <Chip label="Local" size="small" color="success" variant="outlined" />
                        ) : (
                          `$${weeklyChatCost.toFixed(4)}`
                        )}
                      </TableCell>
                    </TableRow>
                  )}

                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="body2" fontWeight={600}>
                        Total Weekly
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
          </CardContent>
        </Card>
      </Box>

      {/* Summary */}
      <Card sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="space-around">
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
              Weekly
            </Typography>
            <Typography variant="h5" fontWeight={700} color="secondary.main">
              ${totalWeeklyCost.toFixed(4)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              for {totalEnabledUsers} user(s)
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">
              Monthly Est.
            </Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">
              ${totalMonthlyCost.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ~4.33 weeks
            </Typography>
          </Box>
        </Stack>
      </Card>
    </Card>
  )
}
