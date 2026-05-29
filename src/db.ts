import dns from 'dns'
import pg from 'pg'
import { CAMPOS_JSONB } from './constants.js'

const { Pool } = pg

let _pool: pg.Pool | null = null

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
  }
}

async function resolveHost(host: string): Promise<string> {
  if (/^[0-9.]+$/.test(host)) return host // já é IPv4
  if (host.includes(':')) return host       // já é IPv6 literal

  try {
    const addresses = await dns.promises.resolve4(host)
    if (addresses.length > 0) return addresses[0]
  } catch {
    // fallback para host original
  }

  return host
}

export async function pool(): Promise<pg.Pool> {
  if (!_pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não configurada')

    const config = parseDatabaseUrl(url)
    const host = await resolveHost(config.host)

    _pool = new Pool({
      host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    })
  }
  return _pool
}

function serializarJsonb(doc: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...doc }
  for (const campo of CAMPOS_JSONB) {
    if (campo in result && typeof result[campo] !== 'string') {
      result[campo] = JSON.stringify(result[campo])
    }
  }
  return result
}

function rowToObj(row: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const key = k === 'id' ? '_id' : k
    obj[key] = v
  }
  return obj
}

export async function inserir(tabela: string, doc: Record<string, unknown>): Promise<string> {
  const agora = new Date().toISOString()
  const data: Record<string, unknown> = {
    ...serializarJsonb(doc),
    criado_em: agora,
    atualizado_em: agora,
  }
  const campos = Object.keys(data)
  const valores = Object.values(data)
  const placeholders = campos.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `INSERT INTO ${tabela} (${campos.join(', ')}) VALUES (${placeholders}) RETURNING id`
  const client = await (await pool()).connect()
  try {
    const res = await client.query(sql, valores)
    return String(res.rows[0].id)
  } finally {
    client.release()
  }
}

export async function atualizar(
  tabela: string,
  id: string,
  campos: Record<string, unknown>
): Promise<boolean> {
  const data = { ...serializarJsonb(campos), atualizado_em: new Date().toISOString() }
  const sets = Object.keys(data)
    .map((k, i) => `${k} = $${i + 1}`)
    .join(', ')
  const valores = [...Object.values(data), id]
  const sql = `UPDATE ${tabela} SET ${sets} WHERE id = $${valores.length} RETURNING id`
  const client = await (await pool()).connect()
  try {
    const res = await client.query(sql, valores)
    return (res.rowCount ?? 0) > 0
  } finally {
    client.release()
  }
}

export async function buscarPorId(
  tabela: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const client = await (await pool()).connect()
  try {
    const res = await client.query(`SELECT * FROM ${tabela} WHERE id = $1`, [id])
    if (res.rows.length === 0) return null
    return rowToObj(res.rows[0] as Record<string, unknown>)
  } finally {
    client.release()
  }
}

export async function deletar(tabela: string, id: string): Promise<boolean> {
  const client = await (await pool()).connect()
  try {
    const res = await client.query(`DELETE FROM ${tabela} WHERE id = $1`, [id])
    return (res.rowCount ?? 0) > 0
  } finally {
    client.release()
  }
}

interface FiltroValor {
  $in?: unknown[]
  $regex?: string
}

export async function listar(
  tabela: string,
  filtro: Record<string, unknown | FiltroValor> = {},
  ordem: [string, 1 | -1 | 0][] = []
): Promise<Record<string, unknown>[]> {
  const condicoes: string[] = []
  const valores: unknown[] = []
  let idx = 1

  for (const [campo, val] of Object.entries(filtro)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const op = val as FiltroValor
      if (op.$in !== undefined) {
        const phs = op.$in.map(() => `$${idx++}`).join(', ')
        condicoes.push(`${campo} IN (${phs})`)
        valores.push(...op.$in)
      } else if (op.$regex !== undefined) {
        condicoes.push(`${campo} ILIKE $${idx++}`)
        valores.push(`%${op.$regex}%`)
      }
    } else {
      condicoes.push(`${campo} = $${idx++}`)
      valores.push(val)
    }
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : ''

  const orderParts = ordem.map(([campo, dir]) => `${campo} ${dir === 1 ? 'ASC' : 'DESC'}`)
  const orderBy = orderParts.length > 0 ? `ORDER BY ${orderParts.join(', ')}` : 'ORDER BY criado_em DESC'

  const sql = `SELECT * FROM ${tabela} ${where} ${orderBy}`
  const client = await (await pool()).connect()
  try {
    const res = await client.query(sql, valores)
    return (res.rows as Record<string, unknown>[]).map(rowToObj)
  } finally {
    client.release()
  }
}

export async function contar(
  tabela: string,
  filtro: Record<string, unknown | FiltroValor> = {}
): Promise<number> {
  const condicoes: string[] = []
  const valores: unknown[] = []
  let idx = 1

  for (const [campo, val] of Object.entries(filtro)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const op = val as FiltroValor
      if (op.$in !== undefined) {
        const phs = op.$in.map(() => `$${idx++}`).join(', ')
        condicoes.push(`${campo} IN (${phs})`)
        valores.push(...op.$in)
      }
    } else {
      condicoes.push(`${campo} = $${idx++}`)
      valores.push(val)
    }
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : ''
  const sql = `SELECT COUNT(*) FROM ${tabela} ${where}`
  const client = await (await pool()).connect()
  try {
    const res = await client.query(sql, valores)
    return parseInt(res.rows[0].count as string, 10)
  } finally {
    client.release()
  }
}

export async function proximoNumero(tabela: string, prefixo: string): Promise<string> {
  const ano = new Date().getFullYear()
  const client = await (await pool()).connect()
  try {
    const res = await client.query(
      `SELECT numero FROM ${tabela} WHERE numero LIKE $1 ORDER BY numero DESC LIMIT 1`,
      [`${prefixo}-${ano}-%`]
    )
    if (res.rows.length === 0) return `${prefixo}-${ano}-001`
    const ultimo = String(res.rows[0].numero)
    const seq = parseInt(ultimo.split('-').pop() ?? '0', 10) + 1
    return `${prefixo}-${ano}-${String(seq).padStart(3, '0')}`
  } finally {
    client.release()
  }
}

export async function testarConexao(): Promise<boolean> {
  try {
    const client = await (await pool()).connect()
    await client.query('SELECT 1')
    client.release()
    return true
  } catch {
    return false
  }
}
