import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createEncoreContext,
  createEncoreTools,
  listEncoreMemories,
  listEncorePlans,
  listEncoreActions,
  getEncorePlan,
  watchPlanCalendar,
  listEncoreCurations,
  controlEncoreCuration,
  runDueEncoreCurations,
  getEncoreActionResult,
  executeEncoreAction,
  getCatalogScope,
  encoreCatalogScope,
} from '@aperture/core/encore'
import { requireAuth } from '../../../plugins/auth.js'
const commands = new Set([
  'rememberPreference',
  'forgetMemory',
  'createWatchPlan',
  'updateWatchPlan',
  'deleteWatchPlan',
  'proposePlaylist',
  'proposeHomeRow',
  'cancelEncoreAction',
  'reconcilePlaylist',
  'prepareCuration',
  'updateCuration',
  'pauseCuration',
])
export function registerWorkbenchHandlers(app: FastifyInstance) {
  app.get('/api/assistant/workbench', { preHandler: requireAuth }, async (request) => {
    const userId = request.user!.id
    const [memories, plans, actions, curations] = await Promise.all([
      listEncoreMemories(userId),
      listEncorePlans(userId),
      listEncoreActions(userId),
      listEncoreCurations(userId),
    ])
    return { ...memories, ...plans, ...actions, ...curations }
  })
  app.get('/api/assistant/curations', { preHandler: requireAuth }, (request) =>
    listEncoreCurations(request.user!.id)
  )
  app.post<{ Params: { id: string } }>(
    '/api/assistant/curations/:id/control',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = z
        .object({
          operation: z.enum(['enable', 'pause', 'run', 'delete']),
          approved: z.literal(true),
        })
        .safeParse(request.body)
      if (!z.string().uuid().safeParse(request.params.id).success || !parsed.success)
        return reply
          .code(400)
          .send({ error: 'Explicit approval and a valid operation are required' })
      try {
        const ctx = {
          ...(await createEncoreContext(request.user!.id)),
          source: 'encore' as const,
          sourceId: 'workbench',
        }
        const result = await controlEncoreCuration(ctx, request.params.id, parsed.data.operation)
        if (parsed.data.operation === 'run')
          await runDueEncoreCurations({ id: request.params.id, userId: request.user!.id, limit: 1 })
        return { ...result, ...(await listEncoreCurations(request.user!.id)) }
      } catch (error) {
        return reply
          .code(409)
          .send({ error: error instanceof Error ? error.message : 'Curation operation failed' })
      }
    }
  )
  app.get<{ Params: { id: string } }>(
    '/api/assistant/actions/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!z.string().uuid().safeParse(request.params.id).success)
        return reply.code(400).send({ error: 'Invalid action ID' })
      try {
        return await getEncoreActionResult(request.user!.id, request.params.id)
      } catch {
        return reply.code(404).send({ error: 'Action not found' })
      }
    }
  )
  app.get<{ Params: { id: string } }>(
    '/api/assistant/plans/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!z.string().uuid().safeParse(request.params.id).success)
        return reply.code(400).send({ error: 'Invalid plan ID' })
      try {
        return { kind: 'watchPlan', plan: await getEncorePlan(request.user!.id, request.params.id) }
      } catch {
        return reply.code(404).send({ error: 'Plan not found' })
      }
    }
  )
  app.post<{ Params: { command: string } }>(
    '/api/assistant/workbench/:command',
    { preHandler: requireAuth, bodyLimit: 128_000 },
    async (request, reply) => {
      if (!commands.has(request.params.command))
        return reply.code(404).send({ error: 'Command not found' })
      try {
        const tools = createEncoreTools({
          ...(await createEncoreContext(request.user!.id)),
          source: 'encore',
          sourceId: 'workbench',
        })
        const tool = tools[request.params.command]
        return await tool.execute!(request.body as never, {
          toolCallId: 'workbench',
          messages: [],
          context: undefined,
        })
      } catch (error) {
        return reply
          .code(400)
          .send({ error: error instanceof Error ? error.message : 'Operation failed' })
      }
    }
  )
  app.post<{ Params: { id: string } }>(
    '/api/assistant/actions/:id/approve',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (
        !z.string().uuid().safeParse(request.params.id).success ||
        !z.object({ approved: z.literal(true) }).safeParse(request.body).success
      )
        return reply.code(400).send({ error: 'Explicit approval of a valid action is required' })
      try {
        return await encoreCatalogScope.run(await getCatalogScope(request.user!.id), () =>
          executeEncoreAction(request.user!.id, request.params.id)
        )
      } catch (error) {
        return reply
          .code(409)
          .send({ error: error instanceof Error ? error.message : 'Action failed' })
      }
    }
  )
  app.get<{ Params: { id: string } }>(
    '/api/assistant/plans/:id/calendar.ics',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!z.string().uuid().safeParse(request.params.id).success)
        return reply.code(400).send({ error: 'Invalid plan ID' })
      try {
        const plan = await getEncorePlan(request.user!.id, request.params.id)
        if (plan.status !== 'saved')
          return reply.code(409).send({ error: 'Save the plan before exporting its calendar' })
        return reply
          .type('text/calendar; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="encore-${plan.id}.ics"`)
          .send(watchPlanCalendar(plan.id, plan.name, plan.schedule.slots))
      } catch {
        return reply.code(404).send({ error: 'Plan not found' })
      }
    }
  )
}
