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
  {
    name: 'ordens_valor',
    sql: `
      ALTER TABLE ordens_servico
        ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2);
    `,
  },
  {
    name: 'contratos',
    sql: `
      CREATE TABLE IF NOT EXISTS contratos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        numero TEXT,
        cliente_id TEXT,
        cliente_nome TEXT NOT NULL,
        cliente_endereco TEXT,
        data DATE,
        qtd_paineis INTEGER,
        locais_paineis TEXT,
        periodicidade TEXT,
        qtd_manutencoes INTEGER,
        valor_total NUMERIC(12,2),
        forma_pagamento TEXT,
        vigencia_meses INTEGER,
        data_inicio DATE,
        data_fim DATE,
        taxa_visita NUMERIC(10,2),
        cronograma_tempo TEXT,
        cronograma_horario TEXT,
        responsavel_tecnico TEXT,
        cft TEXT,
        guid TEXT,
        assinatura_contratada TEXT,
        nome_contratada TEXT,
        assinado_contratada_em TIMESTAMPTZ,
        assinatura_contratante TEXT,
        nome_contratante TEXT,
        assinado_contratante_em TIMESTAMPTZ,
        status TEXT DEFAULT 'rascunho',
        criado_em TIMESTAMPTZ,
        atualizado_em TIMESTAMPTZ
      );
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
