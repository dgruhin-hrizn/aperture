import type { FastifyPluginAsync } from 'fastify'
import healthRoutes from './health.js'
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
import dashboardRoutes from './dashboard.js'
import imageRoutes from './images.js'
import assistantRoutes from './assistant/index.js'

const routes: FastifyPluginAsync = async (fastify) => {
  // Register health check routes
  await fastify.register(healthRoutes)

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

  // Register dashboard routes
  await fastify.register(dashboardRoutes)

  // Register image routes
  await fastify.register(imageRoutes)

  // Register assistant routes
  await fastify.register(assistantRoutes)
}

export default routes
