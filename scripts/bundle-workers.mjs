import { mkdir } from 'fs/promises'
import { createRequire } from 'module'

import { build } from 'esbuild'

// Resolve monaco-editor paths via graphiql, which has it as a transitive dependency
const requireFromGraphiql = createRequire(
  createRequire(import.meta.url).resolve('graphiql/package.json')
)
const requireFromMonacoGraphql = createRequire(
  requireFromGraphiql.resolve('@graphiql/react/package.json')
)

const editorWorker = requireFromGraphiql.resolve('monaco-editor/esm/vs/editor/editor.worker.js')
const jsonWorker = requireFromGraphiql.resolve('monaco-editor/esm/vs/language/json/json.worker.js')
const graphqlWorker = requireFromMonacoGraphql.resolve('monaco-graphql/esm/graphql.worker.js')

await mkdir('public/workers', { recursive: true })

await Promise.all([
  build({
    entryPoints: [editorWorker],
    bundle: true,
    format: 'iife',
    outfile: 'public/workers/editor.worker.js',
    minify: true,
  }),
  build({
    entryPoints: [jsonWorker],
    bundle: true,
    format: 'iife',
    outfile: 'public/workers/json.worker.js',
    minify: true,
  }),
  build({
    entryPoints: [graphqlWorker],
    bundle: true,
    format: 'iife',
    outfile: 'public/workers/graphql.worker.js',
    minify: true,
  }),
])
