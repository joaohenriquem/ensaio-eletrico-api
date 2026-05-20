import { Hono } from 'hono'
import { listar, inserir, atualizar, buscarPorId, proximoNumero, deletar } from '../db.js'
import { authMiddleware } from '../auth.js'
import { enviarEmailAprovacao, enviarEmailConclusao } from '../mailer.js'

const ordens = new Hono()

ordens.use('/*', authMiddleware)

ordens.get('/', async (c) => {
  const status = c.req.query('status')
  const tipo = c.req.query('tipo')
  const cliente = c.req.query('cliente')

  const filtro: Record<string, unknown> = {}
  if (status && status !== 'todos') filtro.status = status
  if (tipo && tipo !== 'todos') filtro.tipo = tipo
  if (cliente) filtro.cliente_nome = { $regex: cliente }

  const lista = await listar('ordens_servico', filtro, [['criado_em', -1]])
  return c.json(lista)
})

ordens.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  if (!body.cliente_nome || !body.descricao) {
    return c.json({ error: 'Cliente e descrição são obrigatórios' }, 400)
  }

  const numero = await proximoNumero('ordens_servico', 'OS')

  const id = await inserir('ordens_servico', {
    numero,
    cliente_id: body.cliente_id ?? null,
    cliente_nome: body.cliente_nome,
    tipo: body.tipo ?? 'Manutenção Preventiva',
    status: body.status ?? 'aberta',
    data: body.data ?? new Date().toISOString().split('T')[0],
    tecnico: body.tecnico ?? 'Amauri Biato',
    local: body.local ?? '',
    prioridade: body.prioridade ?? 'Normal',
    descricao: body.descricao,
    observacoes: body.observacoes ?? '',
    obs_status: '',
  })

  return c.json({ id, numero }, 201)
})

ordens.put('/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()
  const emailConclusao = body._email_conclusao as string | undefined
  delete body._email_conclusao

  const ok = await atualizar('ordens_servico', c.req.param('id'), body)
  if (!ok) return c.json({ error: 'Não encontrado' }, 404)

  if (body.status === 'concluida' && emailConclusao) {
    const os = await buscarPorId('ordens_servico', c.req.param('id'))
    if (os) enviarEmailConclusao(os, emailConclusao).catch(() => null)
  }

  return c.json({ ok: true })
})

ordens.post('/:id/email', async (c) => {
  const { destinatario, tipo } = await c.req.json<{ destinatario: string; tipo: 'aprovacao' | 'conclusao' }>()
  if (!destinatario) return c.json({ error: 'Destinatário obrigatório' }, 400)

  const os = await buscarPorId('ordens_servico', c.req.param('id'))
  if (!os) return c.json({ error: 'Não encontrado' }, 404)

  try {
    if (tipo === 'conclusao') {
      await enviarEmailConclusao(os, destinatario)
    } else {
      await enviarEmailAprovacao(os, destinatario)
    }
    return c.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao enviar e-mail'
    return c.json({ error: msg }, 500)
  }
})

ordens.delete('/:id', async (c) => {
  const ok = await deletar('ordens_servico', c.req.param('id'))
  if (!ok) return c.json({ error: 'Não encontrado' }, 404)
  return c.json({ ok: true })
})

export default ordens
