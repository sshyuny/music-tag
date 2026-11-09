import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildApp } from './app'

const dbPath = resolve(process.env.MUSIC_TAG_DB_PATH ?? 'data/music-tag.sqlite')
const port = Number(process.env.MUSIC_TAG_API_PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MUSIC_TAG_API_PORT는 1~65535 정수여야 합니다')
mkdirSync(dirname(dbPath), { recursive: true })
const db = new DatabaseSync(dbPath)
const app = buildApp(db, true)
app.addHook('onClose', async () => { db.close() })
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch(error => { console.error(error); process.exitCode = 1 }) })
}
try {
  await app.listen({ host: '127.0.0.1', port })
  app.log.info({ dbPath }, 'SQLite DB opened')
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
