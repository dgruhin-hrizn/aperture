import { asSchema } from 'ai'
import { z } from 'zod'
import type { FastifyInstance, FastifySchema, FastifyError, preValidationAsyncHookHandler } from 'fastify'
import fp from 'fastify-plugin'
import { userBodies } from './bodies/users.js'
import { playlistBodies } from './bodies/playlists.js'
import { settingsBodies } from './bodies/settings.js'
import { libraryBodies } from './bodies/library.js'
import { encoreBodies } from './bodies/encore.js'
import { setupBodies } from './bodies/setup.js'
import { queryContracts } from './queries.js'
import { parameterContracts } from './parameters.js'
import { bodylessMutations, delegatedBodies, mcpBodyPolicy } from './policies.js'
import { requestValidator } from './validation.js'

export const bodyContracts: Readonly<Record<string, z.ZodTypeAny>> = {
  ...userBodies, ...playlistBodies, ...settingsBodies, ...libraryBodies, ...encoreBodies, ...setupBodies,
}
const emptyBody = z.object({}).strict().default({})
type JsonSchema = Awaited<ReturnType<typeof asSchema>['jsonSchema']>

async function jsonContract(schema: z.ZodTypeAny) {
  const contract = { ...await asSchema(schema).jsonSchema }
  // Zod applies optional-body defaults before AJV; AJV forbids an ignored root default.
  delete contract.default
  return contract
}

async function compile(contracts: Readonly<Record<string, z.ZodTypeAny>>) {
  return Object.fromEntries(await Promise.all(Object.entries(contracts).map(async ([name, schema]) => [name, await jsonContract(schema)]))) as Record<string, JsonSchema>
}

function mergeObjects(original: unknown, extra: JsonSchema) {
  const current = original && typeof original === 'object' ? original as JsonSchema : {}
  return { ...current, type: 'object', properties: { ...current.properties, ...extra.properties }, required: [...new Set([...(current.required ?? []), ...(extra.required ?? [])])] }
}

/** Install before Swagger/routes so docs and runtime share the same contracts. */
async function registerRequestContracts(app: FastifyInstance) {
  const [bodies, queries, parameters, empty] = await Promise.all([compile(bodyContracts), compile(queryContracts), compile(parameterContracts), jsonContract(emptyBody)])
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.code === 'INVALID_REQUEST') return reply.code(400).send({ error: error.message, code: error.code })
    return reply.send(error)
  })
  app.addHook('onRoute', route => {
    if (route.url === '/mcp') {
      route.schema = { ...route.schema, 'x-aperture-input-validation': mcpBodyPolicy } as FastifySchema
      return
    }
    if (!route.url.startsWith('/api/')) return
    const methods = Array.isArray(route.method) ? route.method : [route.method]
    if (methods.length > 1 && methods.some(method => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method))) throw new Error(`Declare mutation contracts separately for each HTTP method: ${route.url}`)
    const method = methods[0]
    const key = `${method} ${route.url}`
    const schema = { ...route.schema }
    const guards: preValidationAsyncHookHandler[] = []
    if (bodyContracts[key]) {
      schema.body = bodies[key]
      // These are JSON contracts, including the setup wizard's base64 image envelope.
      Object.assign(schema, { consumes: ['application/json'], 'x-aperture-input-validation': 'Canonical Zod contract before handler execution' })
      guards.push(requestValidator(bodyContracts[key], 'body'))
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && schema.body === undefined) {
      if (bodylessMutations.has(key)) {
        schema.body = empty
        guards.push(requestValidator(emptyBody, 'body'))
      } else if (delegatedBodies[key]) {
        Object.assign(schema, { 'x-aperture-input-validation': delegatedBodies[key] })
      } else throw new Error(`Missing explicit HTTP request contract: ${key}`)
    }
    const query = (queryContracts as Readonly<Record<string, z.ZodTypeAny>>)[key]
    if (query) {
      schema.querystring = mergeObjects(schema.querystring, queries[key])
      guards.push(requestValidator(query, 'query'))
    }
    // Fastify's router already extracts strings. Bound every undeclared path parameter;
    // existing domain-specific UUID/enum validators take precedence.
    const names = [...route.url.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)].map(match => match[1])
    const parameter = (parameterContracts as Readonly<Record<string, z.ZodTypeAny>>)[key]
    if (parameter) {
      schema.params = parameters[key]
      guards.push(requestValidator(parameter, 'params'))
    }
    if (names.length) {
      const params = schema.params && typeof schema.params === 'object' ? schema.params as JsonSchema : {}
      if (params.required?.some(name => !names.includes(name))) throw new Error(`Path parameter contract does not match route: ${key}`)
      schema.params = {
        ...params, type: 'object', required: names,
        properties: { ...Object.fromEntries(names.map(name => [name, { type: 'string', minLength: 1, maxLength: 2000 }])), ...params.properties },
      }
    }
    route.schema = schema
    if (guards.length) {
      const existing = route.preValidation ? (Array.isArray(route.preValidation) ? route.preValidation : [route.preValidation]) : []
      route.preValidation = [...guards, ...existing]
    }
  })
}

export const requestContractsPlugin = fp(registerRequestContracts, { name: 'aperture-request-contracts' })
