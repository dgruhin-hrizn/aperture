import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material'
import PsychologyIcon from '@mui/icons-material/Psychology'
import type { EmbeddingModelConfig } from '../types'

interface EmbeddingsSectionProps {
  embeddingConfig: EmbeddingModelConfig | null
  loadingEmbeddingModel: boolean
}

export function EmbeddingsSection({
  embeddingConfig,
  loadingEmbeddingModel,
}: EmbeddingsSectionProps) {
  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <PsychologyIcon color="primary" />
          <Typography variant="h6">AI Embeddings</Typography>
          <Chip label="text-embedding-3-large" size="small" color="success" />
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Using OpenAI's best embedding model with 3,072 dimensions for highest quality 
          recommendations. Captures nuanced similarities in director styles, themes, and tone.
        </Typography>

        {loadingEmbeddingModel ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : embeddingConfig ? (
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Movies</Typography>
                <Typography variant="h6" fontWeight={600}>
                  {embeddingConfig.movieCount.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Embeddings</Typography>
                <Typography variant="h6" fontWeight={600}>
                  {Object.values(embeddingConfig.embeddingsByModel).reduce((a, b) => a + b, 0).toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Est. Cost</Typography>
                <Typography variant="h6" fontWeight={600} color="success.main">
                  {(() => {
                    const tokensPerMovie = 300
                    const totalTokens = embeddingConfig.movieCount * tokensPerMovie
                    const cost = (totalTokens / 1_000_000) * 0.13
                    return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`
                  })()}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Alert severity="warning">
            Could not load embedding status.
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

