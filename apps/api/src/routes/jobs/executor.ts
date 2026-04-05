/**
 * Job Executor
 * Central job execution logic
 */

import {
  syncMovies,
  generateMissingEmbeddings,
  syncWatchHistoryForAllUsers,
  generateRecommendationsForAllUsers,
  clearAndRebuildAllRecommendations,
  processStrmForAllUsers,
  syncSeries,
  generateMissingSeriesEmbeddings,
  syncSeriesWatchHistoryForAllUsers,
  generateSeriesRecommendationsForAllUsers,
  clearAndRebuildAllSeriesRecommendations,
  processSeriesStrmForAllUsers,
  refreshTopPicks,
  enrichMetadata,
  enrichStudioLogos,
  enrichMDBListMetadata,
  processWatchingFavoritesForAllUsers,
  createBackup,
  refreshPricingCache,
  getPricingCacheStatus,
  generateDiscoveryForAllUsers,
  DEFAULT_DISCOVERY_CONFIG,
  createJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
  syncUsersFromMediaServer,
  createChildLogger,
  runLibraryGapAnalysis,
} from '@aperture/core'
import { syncAllTraktRatings } from '../trakt/index.js'
import { refreshAssistantSuggestions } from '../assistant/jobs/refreshSuggestions.js'
import { activeJobs } from './state.js'

const logger = createChildLogger('jobs-executor')

export async function runJob(name: string, jobId: string): Promise<void> {
  const startTime = Date.now()

  try {
    logger.info({ job: name, jobId }, `🚀 Starting job: ${name}`)

    switch (name) {
      case 'sync-users': {
        const result = await syncUsersFromMediaServer(jobId)
        logger.info(
          {
            job: name,
            jobId,
            imported: result.imported,
            updated: result.updated,
            total: result.total,
          },
          `✅ User sync complete`
        )
        break
      }
      case 'sync-movies': {
        const result = await syncMovies(jobId)
        logger.info(
          {
            job: name,
            jobId,
            added: result.added,
            updated: result.updated,
            total: result.total,
          },
          `✅ Movie sync complete`
        )
        break
      }
      case 'generate-movie-embeddings': {
        const result = await generateMissingEmbeddings(jobId)
        logger.info(
          {
            job: name,
            jobId,
            generated: result.generated,
            failed: result.failed,
          },
          `✅ Movie embeddings complete`
        )
        break
      }
      case 'sync-movie-watch-history': {
        const result = await syncWatchHistoryForAllUsers(jobId, true)
        logger.info(
          {
            job: name,
            jobId,
            success: result.success,
            failed: result.failed,
            totalItems: result.totalItems,
          },
          `✅ Movie watch history sync complete`
        )
        break
      }
      case 'generate-movie-recommendations': {
        const result = await generateRecommendationsForAllUsers(jobId)
        logger.info(
          {
            job: name,
            jobId,
            success: result.success,
            failed: result.failed,
          },
          `✅ Movie recommendations complete`
        )
        break
      }
      case 'full-reset-movie-recommendations': {
        const result = await clearAndRebuildAllRecommendations(jobId)
        logger.info(
          {
            job: name,
            jobId,
            cleared: result.cleared,
            success: result.success,
            failed: result.failed,
          },
          `✅ Movie recommendations fully reset`
        )
        break
      }
      case 'sync-movie-libraries': {
        const result = await processStrmForAllUsers(jobId)
        logger.info(
          {
            job: name,
            jobId,
            success: result.success,
            failed: result.failed,
          },
          `✅ Movie libraries sync complete`
        )
        break
      }
      // === Series Jobs ===
      case 'sync-series': {
        const result = await syncSeries(jobId)
        logger.info(
          {
            job: name,
            jobId,
            seriesAdded: result.seriesAdded,
            seriesUpdated: result.seriesUpdated,
            episodesAdded: result.episodesAdded,
            episodesUpdated: result.episodesUpdated,
          },
          `✅ Series sync complete`
        )
        break
      }
      case 'generate-series-embeddings': {
        const result = await generateMissingSeriesEmbeddings(jobId)
        logger.info(
          {
            job: name,
            jobId,
            seriesGenerated: result.seriesGenerated,
            episodesGenerated: result.episodesGenerated,
            failed: result.failed,
          },
          `✅ Series embeddings complete`
        )
        break
      }
      case 'sync-series-watch-history': {
        const result = await syncSeriesWatchHistoryForAllUsers(jobId, true)
        logger.info(
          {
            job: name,
            jobId,
            success: result.success,
            failed: result.failed,
            totalItems: result.totalItems,
          },
          `✅ Series watch history sync complete`
        )
        break
      }
      case 'generate-series-recommendations': {
        const result = await generateSeriesRecommendationsForAllUsers(jobId)
        logger.info(
          {
            job: name,
            jobId,
            success: result.success,
            failed: result.failed,
          },
          `✅ Series recommendations complete`
        )
        break
      }
      case 'full-reset-series-recommendations': {
        const result = await clearAndRebuildAllSeriesRecommendations(jobId)
        logger.info(
          {
            job: name,
            jobId,
            cleared: result.cleared,
            success: result.success,
            failed: result.failed,
          },
          `✅ Series recommendations fully reset`
        )
        break
      }
      case 'sync-series-libraries': {
        const result = await processSeriesStrmForAllUsers(jobId)
        logger.info(
          {
            job: name,
            jobId,
            success: result.success,
            failed: result.failed,
          },
          `✅ Series libraries sync complete`
        )
        break
      }
      // === Top Picks Jobs ===
      case 'refresh-top-picks': {
        const result = await refreshTopPicks(jobId)
        logger.info(
          {
            job: name,
            jobId,
            moviesCount: result.moviesCount,
            seriesCount: result.seriesCount,
            usersUpdated: result.usersUpdated,
          },
          `✅ Top Picks refresh complete`
        )
        break
      }
      case 'auto-request-top-picks': {
        const { runAutoRequestJob } = await import('@aperture/core')
        const result = await runAutoRequestJob(jobId)
        logger.info(
          {
            job: name,
            jobId,
            moviesRequested: result.moviesRequested,
            seriesRequested: result.seriesRequested,
            moviesSkipped: result.moviesSkipped,
            seriesSkipped: result.seriesSkipped,
          },
          `✅ Auto-request Top Picks complete`
        )
        break
      }
      // === Trakt Sync Job ===
      case 'sync-trakt-ratings': {
        const result = await syncAllTraktRatings(jobId)
        logger.info(
          {
            job: name,
            jobId,
            usersProcessed: result.usersProcessed,
            ratingsImported: result.ratingsImported,
            errors: result.errors,
          },
          `✅ Trakt ratings sync complete`
        )
        break
      }
      case 'sync-watching-favorites': {
        const result = await processWatchingFavoritesForAllUsers(jobId)
        logger.info(
          {
            job: name,
            jobId,
            success: result.success,
            failed: result.failed,
            users: result.users.length,
          },
          `✅ Watching favorites sync complete`
        )
        break
      }
      // === Assistant Suggestions Job ===
      case 'refresh-assistant-suggestions': {
        const result = await refreshAssistantSuggestions(jobId)
        logger.info(
          {
            job: name,
            jobId,
            usersProcessed: result.usersProcessed,
            errors: result.errors,
          },
          `✅ Assistant suggestions refresh complete`
        )
        break
      }
      // === Metadata Enrichment Job ===
      case 'enrich-metadata': {
        const result = await enrichMetadata(jobId)
        logger.info(
          {
            job: name,
            jobId,
            moviesEnriched: result.moviesEnriched,
            seriesEnriched: result.seriesEnriched,
            collectionsCreated: result.collectionsCreated,
          },
          `✅ Metadata enrichment complete`
        )
        break
      }
      // === Studio Logo Enrichment Job ===
      case 'enrich-studio-logos': {
        const result = await enrichStudioLogos(jobId)
        logger.info(
          {
            job: name,
            jobId,
            studiosEnriched: result.studiosEnriched,
            networksEnriched: result.networksEnriched,
            logosPushedToEmby: result.logosPushedToEmby,
          },
          `✅ Studio logo enrichment complete`
        )
        break
      }
      // === MDBList Enrichment Job ===
      case 'enrich-mdblist': {
        const result = await enrichMDBListMetadata(jobId)
        logger.info(
          {
            job: name,
            jobId,
            moviesEnriched: result.moviesEnriched,
            seriesEnriched: result.seriesEnriched,
          },
          `✅ MDBList enrichment complete`
        )
        break
      }
      // === Database Backup Job ===
      case 'backup-database': {
        const result = await createBackup()
        if (!result.success) {
          throw new Error(result.error || 'Backup failed')
        }
        logger.info(
          {
            job: name,
            jobId,
            filename: result.filename,
            sizeBytes: result.sizeBytes,
            duration: result.duration,
          },
          `✅ Database backup complete`
        )
        break
      }
      // === AI Pricing Cache Job ===
      case 'refresh-ai-pricing': {
        createJobProgress(jobId, 'refresh-ai-pricing', 2)

        setJobStep(jobId, 0, 'Checking cache status')
        const statusBefore = await getPricingCacheStatus()
        addLog(
          jobId,
          'info',
          `Current cache: ${statusBefore.cached ? `${statusBefore.modelCount} models` : 'empty'}${statusBefore.isStale ? ' (stale)' : ''}`
        )

        setJobStep(jobId, 1, 'Fetching pricing data from Helicone API')
        addLog(jobId, 'info', '🔄 Fetching latest pricing data...')

        await refreshPricingCache()

        const statusAfter = await getPricingCacheStatus()
        addLog(jobId, 'info', `✅ Loaded ${statusAfter.modelCount} model pricing entries`)

        completeJob(jobId, {
          modelCount: statusAfter.modelCount,
          fetchedAt: statusAfter.fetchedAt?.toISOString(),
          cached: statusAfter.cached,
        })

        logger.info(
          {
            job: name,
            jobId,
            cached: statusAfter.cached,
            modelCount: statusAfter.modelCount,
            fetchedAt: statusAfter.fetchedAt,
          },
          `✅ AI pricing cache refreshed`
        )
        break
      }
      // === Discovery Suggestions Job ===
      case 'refresh-library-gaps': {
        createJobProgress(jobId, 'refresh-library-gaps', 4)
        const result = await runLibraryGapAnalysis({ jobId })
        completeJob(jobId, {
          runId: result.runId,
          collectionsScanned: result.collectionsScanned,
          totalParts: result.totalParts,
          ownedParts: result.ownedParts,
          missingCount: result.missingCount,
        })
        logger.info(
          {
            job: name,
            jobId,
            runId: result.runId,
            missingCount: result.missingCount,
          },
          `✅ Library gap analysis complete`
        )
        break
      }
      case 'generate-discovery-suggestions': {
        createJobProgress(jobId, 'generate-discovery-suggestions', 2)

        setJobStep(jobId, 0, 'Checking prerequisites')
        addLog(jobId, 'info', '🔍 Checking Seerr configuration and user enablement...')

        const result = await generateDiscoveryForAllUsers(DEFAULT_DISCOVERY_CONFIG, jobId)

        if (result.success === 0 && result.failed === 0) {
          addLog(
            jobId,
            'warn',
            '⚠️ No users have discovery enabled. Enable discovery for users in Admin → Users.'
          )
        }

        setJobStep(jobId, 1, 'Complete')
        completeJob(jobId, {
          success: result.success,
          failed: result.failed,
        })

        logger.info(
          {
            job: name,
            jobId,
            success: result.success,
            failed: result.failed,
          },
          `✅ Discovery suggestions generation complete`
        )
        break
      }
      default:
        throw new Error(`Unknown job: ${name}`)
    }

    const duration = Date.now() - startTime
    logger.info({ job: name, jobId, duration }, `🏁 Job completed: ${name} (${duration}ms)`)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ job: name, jobId, err }, `❌ Job failed: ${name}`)
    failJob(jobId, error)
    throw err
  } finally {
    activeJobs.delete(name)
  }
}
