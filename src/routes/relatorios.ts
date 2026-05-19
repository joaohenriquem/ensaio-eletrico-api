import { Hono } from 'hono'
import { listar, inserir, atualizar, buscarPorId, proximoNumero } from '../db.js'
import { authMiddleware } from '../auth.js'
import { gerarPdfRelatorio } from '../pdf/relatorio.js'

const relatorios = new Hono()

relatorios.use('/*', authMiddleware)

relatorios.get('/', async (c) => {
  const status = c.req.query('status')
  const filtro: Record<string, unknown> = {}
  if (status && status !== 'todos') filtro.status = status
  const lista = await listar('relatorios', filtro, [['criado_em', -1]])
  return c.json(lista)
})

relatorios.get('/:id', async (c) => {
  const rel = await buscarPorId('relatorios', c.req.param('id'))
  if (!rel) return c.json({ error: 'Não encontrado' }, 404)
  return c.json(rel)
})

relatorios.get('/:id/pdf', async (c) => {
  const rel = await buscarPorId('relatorios', c.req.param('id'))
  if (!rel) return c.json({ error: 'Não encontrado' }, 404)

  const buffer = await gerarPdfRelatorio(rel)
  const numero = String(rel.numero ?? 'relatorio')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${numero}.pdf"`,
    },
  })
})

relatorios.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  if (!body.cliente_nome || !body.local) {
    return c.json({ error: 'Cliente e local são obrigatórios' }, 400)
  }

  const numero = await proximoNumero('relatorios', 'REL')

  const id = await inserir('relatorios', {
    numero,
    cliente_id: body.cliente_id ?? null,
    cliente_nome: body.cliente_nome,
    local: body.local,
    endereco: body.endereco ?? '',
    data: body.data ?? new Date().toISOString().split('T')[0],
    tecnico: body.tecnico ?? 'Amauri Biato',
    cft: body.cft ?? '38346090803',
    trt: body.trt ?? '',
    normas: body.normas ?? [],
    objetivo: body.objetivo ?? '',
    paineis: body.paineis ?? [],
    tomadas: body.tomadas ?? 'Não houve tomadas para troca.',
    iluminacao: body.iluminacao ?? '',
    conclusao: body.conclusao ?? '',
    assinatura: body.assinatura ?? null,
    nome_aprovador: body.nome_aprovador ?? null,
    assinatura_contratado: body.assinatura_contratado ?? null,
    nome_contratado: body.nome_contratado ?? null,
    status: body.status ?? 'rascunho',
  })

  return c.json({ id, numero }, 201)
})

relatorios.put('/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()
  const ok = await atualizar('relatorios', c.req.param('id'), body)
  if (!ok) return c.json({ error: 'Não encontrado' }, 404)
  return c.json({ ok: true })
})

export default relatorios
