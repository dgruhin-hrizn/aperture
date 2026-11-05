import { z } from 'zod'
import type { preValidationAsyncHookHandler } from 'fastify'

function safeIssueMessage(issue: z.ZodIssue) {
  // Enum errors can contain the submitted value. Return schema facts only.
  switch (issue.code) {
    case 'invalid_type': return `Expected ${issue.expected}`
    case 'invalid_enum_value': case 'invalid_literal': return 'Choose a supported value'
    case 'too_small': return 'Value is too small'
    case 'too_big': return 'Value is too large'
    case 'invalid_string': return 'Invalid format'
    case 'unrecognized_keys': return 'Unexpected fields'
    default: return 'Value does not satisfy the required constraints'
  }
}

export function requestValidator(schema: z.ZodTypeAny, part: 'body' | 'query' | 'params'): preValidationAsyncHookHandler {
  return async request => {
    const parsed = await schema.safeParseAsync(request[part])
    if (!parsed.success) {
      const validation = parsed.error.issues.map(issue => ({
        instancePath: '/' + issue.path.map(String).join('/').slice(0, 200), message: safeIssueMessage(issue),
      }))
      const detail = validation.slice(0, 3).map(issue => `${issue.instancePath}: ${issue.message}`).join('; ')
      throw Object.assign(new Error(`Invalid request ${part}: ${detail}`), {
        statusCode: 400, code: 'INVALID_REQUEST', validation, validationContext: part,
      })
    }
    request[part] = parsed.data
  }
}
