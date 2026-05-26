import { pool } from './db.js'

const migrations: { name: string; sql: string }[] = [
  {
    name: 'propostas_assinaturas',
    sql: `
      ALTER TABLE propostas
        ADD COLUMN IF NOT EXISTS assinatura TEXT,
        ADD COLUMN IF NOT EXISTS nome_aprovador TEXT,
        ADD COLUMN IF NOT EXISTS assinatura_contratado TEXT,
        ADD COLUMN IF NOT EXISTS nome_contratado TEXT;
    `,
  },
  {
    name: 'relatorios_assinaturas',
    sql: `
      ALTER TABLE relatorios
        ADD COLUMN IF NOT EXISTS assinatura TEXT,
        ADD COLUMN IF NOT EXISTS nome_aprovador TEXT,
        ADD COLUMN IF NOT EXISTS assinatura_contratado TEXT,
        ADD COLUMN IF NOT EXISTS nome_contratado TEXT;
    `,
  },
  {
    name: 'propostas_fotos',
    sql: `
      ALTER TABLE propostas
        ADD COLUMN IF NOT EXISTS fotos TEXT;
    `,
  },
]

export async function runMigrations(): Promise<void> {
  const p = await pool()
  const client = await p.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        run_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    for (const m of migrations) {
      const { rows } = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [m.name])
      if (rows.length > 0) continue

      console.log(`[migration] running: ${m.name}`)
      await client.query(m.sql)
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [m.name])
      console.log(`[migration] done: ${m.name}`)
    }
  } catch (err) {
    console.error('[migration] error:', err)
  } finally {
    client.release()
  }
}
