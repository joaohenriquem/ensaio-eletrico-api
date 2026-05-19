import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import clientesRoutes from './routes/clientes.js'
import ordensRoutes from './routes/ordens.js'
import relatoriosRoutes from './routes/relatorios.js'
import propostasRoutes from './routes/propostas.js'
import uploadsRoutes from './routes/uploads.js'
import { buscarPorId, atualizar, testarConexao } from './db.js'
import { gerarTokenAcao } from './mailer.js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirnameIdx = dirname(fileURLToPath(import.meta.url))
function logoBase64(): string {
  try {
    const data = readFileSync(resolve(__dirnameIdx, 'static/logo.jpeg'))
    return `data:image/jpeg;base64,${data.toString('base64')}`
  } catch { return '' }
}

const app = new Hono()

app.use(
  '/*',
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      process.env.FRONTEND_URL ?? '',
    ],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

app.use('/*', logger())

app.get('/api/health', async (c) => {
  const dbOk = await testarConexao()
  return c.json({ ok: dbOk, ts: new Date().toISOString(), db: dbOk ? 'ok' : 'unreachable' }, dbOk ? 200 : 503)
})

// rota pública — deve ficar ANTES do router autenticado de ordens
app.get('/api/ordens/:id/resposta', async (c) => {
  const id = c.req.param('id')
  const acao = c.req.query('acao')
  const token = c.req.query('token')

  if (!acao || !token || !['aprovar', 'reprovar'].includes(acao)) {
    return c.html(paginaResposta('erro', 'Link inválido.'))
  }

  const tokenEsperado = gerarTokenAcao(id, acao)
  if (token !== tokenEsperado) {
    return c.html(paginaResposta('erro', 'Link inválido ou expirado.'))
  }

  const os = await buscarPorId('ordens_servico', id)
  if (!os) return c.html(paginaResposta('erro', 'Ordem de Serviço não encontrada.'))

  const novoStatus = acao === 'aprovar' ? 'concluida' : 'cancelada'
  await atualizar('ordens_servico', id, { status: novoStatus })

  const titulo = acao === 'aprovar' ? '✅ OS Aprovada!' : '❌ OS Reprovada'
  const msg = acao === 'aprovar'
    ? `A Ordem de Serviço <strong>${os.numero}</strong> foi <strong style="color:#16a34a;">aprovada</strong> com sucesso. Entraremos em contato em breve.`
    : `A Ordem de Serviço <strong>${os.numero}</strong> foi <strong style="color:#dc2626;">reprovada</strong>. Nossa equipe entrará em contato para entender melhor suas necessidades.`

  return c.html(paginaResposta(acao, msg, titulo))
})

app.route('/api/auth', authRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/clientes', clientesRoutes)
app.route('/api/ordens', ordensRoutes)
app.route('/api/relatorios', relatoriosRoutes)
app.route('/api/propostas', propostasRoutes)
app.route('/api/uploads', uploadsRoutes)

function paginaResposta(tipo: string, mensagem: string, titulo?: string): string {
  const cor = tipo === 'aprovar' ? '#16a34a' : tipo === 'reprovar' ? '#dc2626' : '#6b7280'
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Ensaio Elétrico</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f3f4f6; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.1); max-width: 480px; width: 90%; overflow: hidden; }
    .header { background: #1c1c2e; padding: 28px; text-align: center; }
    .header h1 { color: #f0a500; font-size: 22px; }
    .header p { color: rgba(255,255,255,.5); font-size: 13px; margin-top: 4px; }
    .body { padding: 36px 32px; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    .titulo { font-size: 22px; font-weight: bold; color: ${cor}; margin-bottom: 12px; }
    .msg { color: #374151; font-size: 15px; line-height: 1.6; }
    .footer { background: #1c1c2e; padding: 14px; text-align: center; }
    .footer p { color: rgba(255,255,255,.3); font-size: 11px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${logoBase64() ? `<img src="${logoBase64()}" alt="Ensaio Elétrico" style="height:64px;width:auto;" />` : '<h1>ENSAIO ELÉTRICO</h1>'}
    </div>
    <div class="body">
      <div class="icon">${tipo === 'aprovar' ? '✅' : tipo === 'reprovar' ? '❌' : '⚠️'}</div>
      <div class="titulo">${titulo ?? 'Erro'}</div>
      <p class="msg">${mensagem}</p>
    </div>
    <div class="footer">
      <p>Ensaio Elétrico · CNPJ 61.841.485/0001-30 · Osasco – SP</p>
    </div>
  </div>
</body>
</html>`
}

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`🔥 Ensaio Elétrico API rodando em http://localhost:${port}`)
})
