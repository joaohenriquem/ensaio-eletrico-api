import { Hono } from 'hono'
import { listar, inserir, atualizar, buscarPorId, proximoNumero, deletar } from '../db.js'
import { authMiddleware } from '../auth.js'
import { gerarPdfContrato } from '../pdf/contrato.js'
import { gerarTokenAcao, enviarEmailAssinaturaContrato } from '../mailer.js'
import { dataHojeBR, reverseGeocode } from '../helpers.js'
import { EMPRESA } from '../constants.js'

const contratos = new Hono()

const ACAO_ASSINAR = 'assinar-contrato'

function tokenValido(id: string, token: string | undefined): boolean {
  return !!token && token === gerarTokenAcao(id, ACAO_ASSINAR)
}

// ── ROTAS PÚBLICAS (assinatura do cliente via link com token) ─────────────
// Registradas ANTES do authMiddleware para dispensarem login.

contratos.get('/:id/publico', async (c) => {
  const id = c.req.param('id')
  if (!tokenValido(id, c.req.query('token'))) return c.json({ error: 'Link inválido ou expirado' }, 401)

  const contrato = await buscarPorId('contratos', id)
  if (!contrato) return c.json({ error: 'Não encontrado' }, 404)

  if (!contrato.visualizado_contratante_em) {
    contrato.visualizado_contratante_em = new Date().toISOString()
    await atualizar('contratos', id, { visualizado_contratante_em: contrato.visualizado_contratante_em })
  }

  // expõe apenas o necessário para a página pública (sem dados internos)
  return c.json({
    _id: contrato._id,
    numero: contrato.numero,
    cliente_nome: contrato.cliente_nome,
    cliente_endereco: contrato.cliente_endereco,
    data: contrato.data,
    qtd_paineis: contrato.qtd_paineis,
    locais_paineis: contrato.locais_paineis,
    periodicidade: contrato.periodicidade,
    qtd_manutencoes: contrato.qtd_manutencoes,
    valor_total: contrato.valor_total,
    forma_pagamento: contrato.forma_pagamento,
    vigencia_meses: contrato.vigencia_meses,
    data_inicio: contrato.data_inicio,
    data_fim: contrato.data_fim,
    taxa_visita: contrato.taxa_visita,
    cronograma_tempo: contrato.cronograma_tempo,
    cronograma_horario: contrato.cronograma_horario,
    responsavel_tecnico: contrato.responsavel_tecnico,
    cft: contrato.cft,
    guid: contrato.guid,
    assinatura_contratada: contrato.assinatura_contratada,
    nome_contratada: contrato.nome_contratada,
    assinado_contratada_em: contrato.assinado_contratada_em,
    endereco_contratada: contrato.endereco_contratada,
    assinatura_contratante: contrato.assinatura_contratante,
    nome_contratante: contrato.nome_contratante,
    assinado_contratante_em: contrato.assinado_contratante_em,
    endereco_contratante: contrato.endereco_contratante,
    visualizado_contratante_em: contrato.visualizado_contratante_em,
    assinado: !!contrato.assinado_contratante_em,
    assinado_em: contrato.assinado_contratante_em,
  })
})

contratos.get('/:id/pdf-publico', async (c) => {
  const id = c.req.param('id')
  if (!tokenValido(id, c.req.query('token'))) return c.json({ error: 'Link inválido ou expirado' }, 401)

  const contrato = await buscarPorId('contratos', id)
  if (!contrato) return c.json({ error: 'Não encontrado' }, 404)

  const buffer = await gerarPdfContrato(contrato)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${String(contrato.numero ?? 'contrato')}.pdf"`,
    },
  })
})

contratos.post('/:id/assinar', async (c) => {
  const id = c.req.param('id')
  if (!tokenValido(id, c.req.query('token'))) return c.json({ error: 'Link inválido ou expirado' }, 401)

  const contrato = await buscarPorId('contratos', id)
  if (!contrato) return c.json({ error: 'Não encontrado' }, 404)
  if (contrato.assinado_contratante_em) return c.json({ error: 'Este contrato já foi assinado' }, 409)

  const { nome, assinatura, latitude, longitude } = await c.req.json<{
    nome?: string
    assinatura?: string
    latitude?: number
    longitude?: number
  }>()
  if (!nome || !assinatura) return c.json({ error: 'Nome e assinatura são obrigatórios' }, 400)

  const endereco = (latitude != null && longitude != null) ? await reverseGeocode(latitude, longitude) : ''

  await atualizar('contratos', id, {
    nome_contratante: nome,
    assinatura_contratante: assinatura,
    assinado_contratante_em: new Date().toISOString(),
    latitude_contratante: latitude ?? null,
    longitude_contratante: longitude ?? null,
    endereco_contratante: endereco || null,
    status: 'assinado',
  })

  return c.json({ ok: true })
})

// ── ROTAS AUTENTICADAS ────────────────────────────────────────────────────

contratos.use('/*', authMiddleware)

contratos.get('/', async (c) => {
  const status = c.req.query('status')
  const cliente = c.req.query('cliente')

  const filtro: Record<string, unknown> = {}
  if (status && status !== 'todos') filtro.status = status
  if (cliente) filtro.cliente_nome = { $regex: cliente }

  const lista = await listar('contratos', filtro, [['criado_em', -1]])
  return c.json(lista)
})

contratos.get('/:id', async (c) => {
  const contrato = await buscarPorId('contratos', c.req.param('id'))
  if (!contrato) return c.json({ error: 'Não encontrado' }, 404)
  return c.json(contrato)
})

contratos.get('/:id/pdf', async (c) => {
  const contrato = await buscarPorId('contratos', c.req.param('id'))
  if (!contrato) return c.json({ error: 'Não encontrado' }, 404)

  const buffer = await gerarPdfContrato(contrato)
  const numero = String(contrato.numero ?? 'contrato')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${numero}.pdf"`,
    },
  })
})

// token para montar o link público de assinatura no frontend
contratos.get('/:id/link', async (c) => {
  const id = c.req.param('id')
  const contrato = await buscarPorId('contratos', id)
  if (!contrato) return c.json({ error: 'Não encontrado' }, 404)

  if (contrato.status === 'rascunho') {
    await atualizar('contratos', id, { status: 'aguardando_assinatura' })
  }

  return c.json({ token: gerarTokenAcao(id, ACAO_ASSINAR) })
})

contratos.post('/:id/email', async (c) => {
  const { destinatario } = await c.req.json<{ destinatario?: string }>()
  if (!destinatario) return c.json({ error: 'Destinatário obrigatório' }, 400)

  const id = c.req.param('id')
  const contrato = await buscarPorId('contratos', id)
  if (!contrato) return c.json({ error: 'Não encontrado' }, 404)

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const link = `${frontendUrl}/assinar-contrato/${id}?token=${gerarTokenAcao(id, ACAO_ASSINAR)}`

  try {
    await enviarEmailAssinaturaContrato(contrato, destinatario, link)
    if (contrato.status === 'rascunho') {
      await atualizar('contratos', id, { status: 'aguardando_assinatura' })
    }
    return c.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao enviar e-mail'
    return c.json({ error: msg }, 500)
  }
})

contratos.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  if (!body.cliente_nome) {
    return c.json({ error: 'Cliente é obrigatório' }, 400)
  }

  const numero = await proximoNumero('contratos', 'CONT')
  const agora = new Date().toISOString()

  const latContratada = body.latitude_contratada as number | undefined
  const lonContratada = body.longitude_contratada as number | undefined
  const enderecoContratada = (body.assinatura_contratada && latContratada != null && lonContratada != null)
    ? await reverseGeocode(latContratada, lonContratada)
    : ''

  const id = await inserir('contratos', {
    numero,
    cliente_id: body.cliente_id ?? null,
    cliente_nome: body.cliente_nome,
    cliente_endereco: body.cliente_endereco ?? '',
    data: body.data ?? dataHojeBR(),
    qtd_paineis: body.qtd_paineis ?? 0,
    locais_paineis: body.locais_paineis ?? '',
    periodicidade: body.periodicidade ?? '',
    qtd_manutencoes: body.qtd_manutencoes ?? 0,
    valor_total: body.valor_total ?? 0,
    forma_pagamento: body.forma_pagamento ?? '',
    vigencia_meses: body.vigencia_meses ?? 12,
    data_inicio: body.data_inicio ?? null,
    data_fim: body.data_fim ?? null,
    taxa_visita: body.taxa_visita ?? 200,
    cronograma_tempo: body.cronograma_tempo ?? '1 dia (podendo ser num sábado)',
    cronograma_horario: body.cronograma_horario ?? 'das 08h00 às 16h00',
    responsavel_tecnico: body.responsavel_tecnico ?? 'AMAURI MOURA BIATO DA SILVA',
    cft: body.cft ?? EMPRESA.cft,
    guid: crypto.randomUUID(),
    assinatura_contratada: body.assinatura_contratada ?? null,
    nome_contratada: body.nome_contratada ?? null,
    assinado_contratada_em: body.assinatura_contratada ? agora : null,
    latitude_contratada: body.assinatura_contratada ? (latContratada ?? null) : null,
    longitude_contratada: body.assinatura_contratada ? (lonContratada ?? null) : null,
    endereco_contratada: enderecoContratada || null,
    status: body.status ?? 'rascunho',
  })

  return c.json({ id, numero }, 201)
})

contratos.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<Record<string, unknown>>()

  const existente = await buscarPorId('contratos', id)
  if (!existente) return c.json({ error: 'Não encontrado' }, 404)

  // registra o momento e a localização da assinatura da contratada na primeira vez
  if (body.assinatura_contratada && !existente.assinado_contratada_em) {
    body.assinado_contratada_em = new Date().toISOString()
    const lat = body.latitude_contratada as number | undefined
    const lon = body.longitude_contratada as number | undefined
    if (lat != null && lon != null) {
      body.endereco_contratada = (await reverseGeocode(lat, lon)) || null
    }
  }

  const ok = await atualizar('contratos', id, body)
  if (!ok) return c.json({ error: 'Não encontrado' }, 404)
  return c.json({ ok: true })
})

contratos.delete('/:id', async (c) => {
  const ok = await deletar('contratos', c.req.param('id'))
  if (!ok) return c.json({ error: 'Não encontrado' }, 404)
  return c.json({ ok: true })
})

export default contratos
