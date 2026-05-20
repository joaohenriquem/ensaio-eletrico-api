import { Hono } from 'hono'
import { listar, inserir, atualizar, buscarPorId, deletar } from '../db.js'
import { authMiddleware } from '../auth.js'

const clientes = new Hono()

clientes.use('/*', authMiddleware)

clientes.get('/', async (c) => {
  const ativo = c.req.query('ativo')
  const busca = c.req.query('busca')

  const filtro: Record<string, unknown> = {}
  if (ativo === 'true') filtro.ativo = true
  if (ativo === 'false') filtro.ativo = false
  if (busca) filtro.nome = { $regex: busca }

  const lista = await listar('clientes', filtro, [['nome', 1]])
  return c.json(lista)
})

clientes.get('/:id', async (c) => {
  const cliente = await buscarPorId('clientes', c.req.param('id'))
  if (!cliente) return c.json({ error: 'Não encontrado' }, 404)
  return c.json(cliente)
})

clientes.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  if (!body.nome || !body.cidade) {
    return c.json({ error: 'Nome e cidade são obrigatórios' }, 400)
  }

  const id = await inserir('clientes', {
    nome: body.nome,
    endereco: body.endereco ?? '',
    cidade: body.cidade,
    estado: body.estado ?? 'SP',
    contato: body.contato ?? '',
    telefone: body.telefone ?? '',
    email: body.email ?? '',
    sindico: body.sindico ?? '',
    torres: body.torres ?? 1,
    observacoes: body.observacoes ?? '',
    ativo: true,
  })

  return c.json({ id }, 201)
})

clientes.put('/:id', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()
  const ok = await atualizar('clientes', c.req.param('id'), body)
  if (!ok) return c.json({ error: 'Não encontrado' }, 404)
  return c.json({ ok: true })
})

clientes.delete('/:id', async (c) => {
  const ok = await deletar('clientes', c.req.param('id'))
  if (!ok) return c.json({ error: 'Não encontrado' }, 404)
  return c.json({ ok: true })
})

export default clientes
