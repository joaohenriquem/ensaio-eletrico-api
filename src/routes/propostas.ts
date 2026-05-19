import { Hono } from 'hono'
import { listar, inserir, atualizar, buscarPorId, proximoNumero } from '../db.js'
import { authMiddleware } from '../auth.js'
import { gerarPdfProposta } from '../pdf/proposta.js'

const propostas = new Hono()

propostas.use('/*', authMiddleware)

propostas.get('/', async (c) => {
  const status = c.req.query('status')
  const cliente = c.req.query('cliente')

  const filtro: Record<string, unknown> = {}
  if (status && status !== 'todos') filtro.status = status
  if (cliente) filtro.cliente_nome = { $regex: cliente }

  const lista = await listar('propostas', filtro, [['criado_em', -1]])
  return c.json(lista)
})

propostas.get('/:id', async (c) => {
  const proposta = await buscarPorId('propostas', c.req.param('id'))
  if (!proposta) return c.json({ error: 'Não encontrado' }, 404)
  return c.json(proposta)
})

propostas.get('/:id/pdf', async (c) => {
  const proposta = await buscarPorId('propostas', c.req.param('id'))
  if (!proposta) return c.json({ error: 'Não encontrado' }, 404)

  const buffer = await gerarPdfProposta(proposta)
  const numero = String(proposta.numero ?? 'proposta')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${numero}.pdf"`,
    },
  })
})

propostas.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  if (!body.cliente_nome || !body.descricao) {
    return c.json({ error: 'Cliente e descrição são obrigatórios' }, 400)
  }

  const investimento = (body.investimento as { descricao: string; valor: number }[]) ?? []
  const total = investimento.reduce((acc, item) => acc + Number(item.valor ?? 0), 0)

  const numero = await proximoNumero('propostas', 'PROP')

  const id = await inserir('propostas', {
    numero,
    cliente_id: body.cliente_id ?? null,
    cliente_nome: body.cliente_nome,
    cliente_endereco: body.cliente_endereco ?? '',
    data: body.data ?? new Date().toISOString().split('T')[0],
    descricao: body.descricao,
    objetivo: body.objetivo ?? '',
    servicos: body.servicos ?? [],
    materiais: body.materiais ?? [],
    etapas: body.etapas ?? [],
    normas: body.normas ?? [],
    prazo: body.prazo ?? '5 dias',
    garantia: body.garantia ?? '24 meses nos serviços executados / materiais conforme fabricante',
    condicoes_pagamento: body.condicoes_pagamento ?? '',
    investimento,
    total,
    assinatura: body.assinatura ?? null,
    nome_aprovador: body.nome_aprovador ?? null,
    assinatura_contratado: body.assinatura_contratado ?? null,
    nome_contratado: body.nome_contratado ?? null,
    status: body.status ?? 'rascunho',
  })

  return c.json({ id, numero }, 201)
})

propostas.put('/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  if (body.investimento) {
    const inv = body.investimento as { descricao: string; valor: number }[]
    body.total = inv.reduce((acc, item) => acc + Number(item.valor ?? 0), 0)
  }

  const ok = await atualizar('propostas', c.req.param('id'), body)
  if (!ok) return c.json({ error: 'Não encontrado' }, 404)
  return c.json({ ok: true })
})

export default propostas
