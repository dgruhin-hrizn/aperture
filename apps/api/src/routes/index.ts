import type { FastifyPluginAsync } from 'fastify'
import healthRoutes from './health.js'
import setupRoutes from './setup.js'
import apiRoutes from './api.js'
import authRoutes from './auth.js'
import usersRoutes from './users/index.js'
import moviesRoutes from './movies.js'
import seriesRoutes from './series.js'
import ratingsRoutes from './ratings.js'
import recommendationsRoutes from './recommendations.js'
import channelsRoutes from './channels/index.js'
import jobsRoutes from './jobs.js'
import settingsRoutes from './settings.js'
import topPicksRoutes from './top-picks.js'
import traktRoutes from './trakt.js'
import mdblistRoutes from './mdblist.js'
import dashboardRoutes from './dashboard.js'
import imageRoutes from './images.js'
import mediaProxyRoutes from './media-proxy.js'
import assistantRoutes from './assistant/index.js'
import searchRoutes from './search.js'
import discoverRoutes from './discover.js'
import watchingRoutes from './watching.js'
import backupRoutes from './backup.js'
import maintenanceRoutes from './maintenance.js'
import apiErrorsRoutes from './apiErrors.js'

const routes: FastifyPluginAsync = async (fastify) => {
  // Register health check routes
  await fastify.register(healthRoutes)

  // Register setup routes (public - for first-run wizard)
  await fastify.register(setupRoutes)

  // Register API routes
  await fastify.register(apiRoutes)

  // Register auth routes
  await fastify.register(authRoutes)

  // Register users routes
  await fastify.register(usersRoutes)

  // Register movies routes
  await fastify.register(moviesRoutes)

  // Register series routes
  await fastify.register(seriesRoutes)

  // Register ratings routes
  await fastify.register(ratingsRoutes)

  // Register recommendations routes
  await fastify.register(recommendationsRoutes)

  // Register channels routes
  await fastify.register(channelsRoutes)

  // Register jobs routes
  await fastify.register(jobsRoutes)

  // Register settings routes
  await fastify.register(settingsRoutes)

  // Register top picks routes
  await fastify.register(topPicksRoutes)

  // Register Trakt routes
  await fastify.register(traktRoutes)

  // Register MDBList routes
  await fastify.register(mdblistRoutes)

  // Register dashboard routes
  await fastify.register(dashboardRoutes)

  // Register image routes
  await fastify.register(imageRoutes)

  // Register media proxy routes (for proxying Emby/Jellyfin images)
  await fastify.register(mediaProxyRoutes)

  // Register assistant routes
  await fastify.register(assistantRoutes)

  // Register search routes
  await fastify.register(searchRoutes)

  // Register discover routes (person/studio browsing)
  await fastify.register(discoverRoutes)

  // Register watching routes
  await fastify.register(watchingRoutes)

  // Register backup routes
  await fastify.register(backupRoutes)

  // Register maintenance routes
  await fastify.register(maintenanceRoutes)

  // Register API errors routes
  await fastify.register(apiErrorsRoutes)
}

export default routes
