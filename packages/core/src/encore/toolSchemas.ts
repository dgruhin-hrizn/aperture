import { asSchema, type ToolSet } from 'ai'

type ToolInputSchema = Awaited<ReturnType<typeof asSchema>['jsonSchema']>

/** Validate the public wire contract before sending any tool to a model or MCP client. */
export async function getEncoreToolSchemas(tools: ToolSet) {
  const schemas: Record<string, ToolInputSchema> = {}
  for (const [name, definition] of Object.entries(tools)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw new Error(`Invalid Encore tool name: ${name}`)
    const input = asSchema(definition.inputSchema)
    const schema = await input.jsonSchema
    if (schema.type !== 'object' || schema.anyOf || schema.oneOf)
      throw new Error(
        `Invalid Encore input schema for ${name}: an object root without a top-level union is required`
      )
    if (!input.validate) throw new Error(`Invalid Encore input schema for ${name}: a runtime validator is required`)
    schemas[name] = schema
  }
  return schemas
}

/** Direct callers must use the same canonical validation/transforms as the model runtime. */
export async function validateEncoreToolInput(definition: ToolSet[string], value: unknown) {
  const validate = asSchema(definition.inputSchema).validate
  if (!validate) throw new Error('Encore tool has no runtime input validator')
  const result = await validate(value)
  if (!result.success) throw new Error('Invalid tool arguments', { cause: result.error })
  return result.value
}
