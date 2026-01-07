/**
 * System help tools with Tool UI output
 */
import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from '../types.js'

export function createHelpTools(ctx: ToolContext) {
  return {
    getSystemHelp: tool({
      description: 'Get help on how to use Aperture.',
      inputSchema: z.object({
        topic: z.string().optional().describe('Specific topic (ratings, recommendations, jobs)'),
      }),
      execute: async ({ topic }) => {
        const generalHelp = {
          overview: 'Aperture is an AI-powered recommendation system for your media server.',
          capabilities: [
            'AI-generated personalized movie and TV series recommendations',
            '10-heart rating system (syncs with Trakt.tv)',
            'Watch history tracking and analytics',
            'Virtual "AI Picks" libraries in your media server',
            'Top Picks showing globally popular content',
            'Detailed watch stats with genre/actor/director breakdowns',
          ],
          navigation: {
            Dashboard: 'Overview with recent watches, ratings, trending, and recommendations',
            Movies: 'Browse your movie library with search and genre filters',
            Series: 'Browse TV series with network filters',
            'Top Movies/Series': "See what's popular across all users",
            History: 'Your complete watch history',
            'Watch Stats': 'Analytics about your viewing habits',
          },
        }

        const topicHelp: Record<string, unknown> = {
          ratings: {
            title: 'Rating System',
            description: 'Aperture uses a 10-heart system compatible with Trakt.tv.',
            howTo: [
              'Click the heart icon in the bottom-right of any poster',
              'Select your rating (1-10 hearts) in the popup',
              'Ratings sync to Trakt.tv if connected',
            ],
            impact: [
              'High ratings (7+) boost similar content in recommendations',
              'Low ratings (3 or below) exclude similar content by default',
              'You can change "exclude" to "penalize" in settings',
            ],
          },
          recommendations: {
            title: 'AI Recommendations',
            description: 'Aperture analyzes your watch history to generate personalized picks.',
            factors: [
              'Content similarity via AI embeddings',
              'Genre preferences from your history',
              'Your ratings (likes boost, dislikes reduce)',
              'Novelty factor to suggest new genres',
            ],
            accessing: [
              'View in Dashboard under "Your Picks"',
              'Find in your media server under "AI Picks" library',
              'See full list in My Recommendations page',
            ],
          },
          watchHistory: {
            title: 'Watch History',
            description: 'Aperture tracks what you watch from your media server automatically.',
            features: [
              'View all watched movies and episodes',
              'See when you watched and how many times',
              'Filter by movies or series',
              'Data syncs from your Emby/Jellyfin server',
            ],
          },
          trakt: {
            title: 'Trakt.tv Integration',
            description: 'Connect your Trakt account to sync ratings.',
            features: [
              'Ratings sync bidirectionally',
              'Import your existing Trakt ratings',
              'Rate in Aperture, updates in Trakt',
            ],
            setup: ['Go to User Settings', 'Click "Connect to Trakt"', 'Authorize Aperture'],
          },
        }

        // Check for topic match
        if (topic) {
          const normalizedTopic = topic.toLowerCase()
          for (const [key, value] of Object.entries(topicHelp)) {
            if (normalizedTopic.includes(key)) {
              return { id: `help-${key}`, topic: key, help: value, isAdmin: ctx.isAdmin }
            }
          }
        }

        // Admin-specific help
        const adminHelp = ctx.isAdmin
          ? {
              adminCapabilities: [
                'Run sync jobs to import movies/series from media server',
                'Generate embeddings for AI similarity matching',
                'Configure recommendation algorithm weights',
                'Manage users and their recommendation access',
                'Schedule automated jobs (sync, recommendations)',
                'Upload custom library banner images',
              ],
              jobs: {
                'Sync Movies': 'Import movie metadata from Emby/Jellyfin',
                'Sync Series': 'Import TV series metadata',
                'Generate Movie Embeddings': 'Create AI vectors for similarity',
                'Generate Series Embeddings': 'Create AI vectors for series',
                'Sync Movie Watch History': 'Import watch data from media server',
                'Sync Series Watch History': 'Import episode watch data',
                'Generate Movie Recommendations': 'Run AI recommendation pipeline',
                'Generate Series Recommendations': 'Run series recommendation pipeline',
              },
              settings: {
                'Algorithm Weights': 'Tune similarity, novelty, rating, diversity factors',
                'Embedding Model': 'Choose between text-embedding-3-small and large',
                'Output Type': 'STRM files vs Symlinks for recommendation libraries',
                'Library Images': 'Upload 16:9 banners for AI Picks libraries',
              },
            }
          : null

        return { id: `help-general-${Date.now()}`, generalHelp, adminHelp, isAdmin: ctx.isAdmin }
      },
    }),
  }
}
