import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const popular = fs.readFileSync('/tmp/graphql_popular_query.txt', 'utf8').trim()
const search = fs.readFileSync('/tmp/graphql_search_query.txt', 'utf8').trim()
const providers = fs.readFileSync('/tmp/graphql_providers_query.txt', 'utf8').trim()

const out =
  `/**
 * GraphQL operation documents aligned with JustWatch public web API.
 * Query structure derived from Electronic-Mango/simple-justwatch-python-api (MIT).
 */

export const POPULAR_TITLES_QUERY = ${JSON.stringify(popular)}

export const SEARCH_TITLES_QUERY = ${JSON.stringify(search)}

export const PROVIDERS_QUERY = ${JSON.stringify(providers)}
`

const target = path.join(root, 'packages/core/src/justwatch/graphqlQueries.ts')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, out)
console.log('Wrote', target, out.length)
