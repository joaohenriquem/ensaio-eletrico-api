import { Hono } from 'hono'
import { contar, listar } from '../db.js'
import { authMiddleware } from '../auth.js'

const dashboard = new Hono()

dashboard.use('/*', authMiddleware)

dashboard.get('/stats', async (c) => {
  const [
    clientesAtivos,
    osAbertas,
    osConcluidas,
    totalRelatorios,
    totalPropostas,
    propostasAprovadas,
    osRecentes,
    distribuicaoOs,
    distribuicaoPropostas,
  ] = await Promise.all([
    contar('clientes', { ativo: true }),
    contar('ordens_servico', { status: { $in: ['aberta', 'em_andamento'] } }),
    contar('ordens_servico', { status: 'concluida' }),
    contar('relatorios'),
    contar('propostas'),
    listar('propostas', { status: 'aprovado' }),
    listar('ordens_servico', {}, [['criado_em', -1]]),
    listar('ordens_servico'),
    listar('propostas'),
  ])

  const receitaAprovada = propostasAprovadas.reduce(
    (acc, p) => acc + Number(p.total ?? 0),
    0
  )

  const contarPorStatus = (lista: Record<string, unknown>[], campo = 'status') => {
    const map: Record<string, number> = {}
    for (const item of lista) {
      const s = String(item[campo] ?? 'desconhecido')
      map[s] = (map[s] ?? 0) + 1
    }
    return map
  }

  return c.json({
    clientesAtivos,
    osAbertas,
    osConcluidas,
    totalRelatorios,
    totalPropostas,
    propostasAprovadas: propostasAprovadas.length,
    receitaAprovada,
    osRecentes: osRecentes.slice(0, 10),
    distribuicaoOs: contarPorStatus(distribuicaoOs),
    distribuicaoPropostas: contarPorStatus(distribuicaoPropostas),
  })
})

export default dashboard
