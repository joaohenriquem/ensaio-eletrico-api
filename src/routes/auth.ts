import { Hono } from 'hono'
import { listar, inserir, buscarPorId, atualizar } from '../db.js'
import { verificarSenha, gerarToken, hashSenha, authMiddleware } from '../auth.js'
import type { JwtPayload } from '../auth.js'
import {
  enviarEmailOtp,
  enviarEmailResetSenha,
  enviarEmailCadastroRecebido,
  enviarEmailAdminNovoCadastro,
  enviarEmailUsuarioAprovado,
  enviarEmailUsuarioRejeitado,
} from '../mailer.js'

const auth = new Hono<{ Variables: { user: JwtPayload } }>()

function gerarOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'EnsaioEletrico/2.0' } }
    )
    const data = await res.json() as { display_name?: string; address?: { city?: string; town?: string; state?: string; country?: string } }
    const a = data.address ?? {}
    const cidade = a.city ?? a.town ?? ''
    const estado = a.state ?? ''
    const pais = a.country ?? ''
    return [cidade, estado, pais].filter(Boolean).join(', ') || data.display_name || ''
  } catch {
    return ''
  }
}

auth.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>()
  const login = String(username ?? '').trim()

  if (!login || !password) {
    return c.json({ error: 'Usuário e senha são obrigatórios' }, 400)
  }

  const usuarios = await listar('usuarios', { username: login })
  if (usuarios.length === 0) {
    return c.json({ error: 'Usuário ou senha inválidos' }, 401)
  }

  const usuario = usuarios[0]
  const senhaCorreta = await verificarSenha(password, String(usuario.senha))
  if (!senhaCorreta) {
    return c.json({ error: 'Usuário ou senha inválidos' }, 401)
  }

  const status = String(usuario.status ?? 'aprovado')
  if (status === 'pendente') {
    return c.json({ error: 'Seu cadastro ainda está aguardando aprovação.' }, 403)
  }
  if (status === 'rejeitado') {
    return c.json({ error: 'Seu cadastro não foi aprovado. Entre em contato com o administrador.' }, 403)
  }

  const email = String(usuario.email ?? '').trim()
  const nome = String(usuario.nome ?? login)

  if (!email) {
    return c.json({ error: 'Este usuário não possui e-mail cadastrado. Contate o administrador.' }, 400)
  }

  const otp = gerarOtp()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  await atualizar('usuarios', String(usuario._id), { otp_code: otp, otp_expires_at: expiresAt })

  try {
    await enviarEmailOtp(email, nome, otp)
  } catch (err) {
    console.error('Erro ao enviar OTP:', err)
    return c.json({ error: 'Erro ao enviar código de verificação. Tente novamente.' }, 500)
  }

  return c.json({ requiresMfa: true, userId: String(usuario._id), email: email.replace(/(.{2}).+(@.+)/, '$1***$2') })
})

auth.post('/verify-otp', async (c) => {
  const { userId, otp, latitude, longitude } = await c.req.json<{
    userId: string
    otp: string
    latitude?: number
    longitude?: number
  }>()

  if (!userId || !otp) {
    return c.json({ error: 'Dados inválidos' }, 400)
  }

  const usuario = await buscarPorId('usuarios', userId)
  if (!usuario) return c.json({ error: 'Usuário não encontrado' }, 404)

  if (!usuario.otp_code || usuario.otp_code !== otp) {
    return c.json({ error: 'Código inválido' }, 401)
  }

  const expiresAt = new Date(String(usuario.otp_expires_at)).getTime()
  if (Date.now() > expiresAt) {
    return c.json({ error: 'Código expirado. Faça login novamente.' }, 401)
  }

  await atualizar('usuarios', userId, { otp_code: null, otp_expires_at: null })

  let endereco = ''
  if (latitude != null && longitude != null) {
    endereco = await reverseGeocode(latitude, longitude)
  }

  try {
    await inserir('login_logs', {
      usuario_id: userId,
      usuario_nome: String(usuario.nome ?? ''),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      endereco: endereco || null,
    })
  } catch (err) {
    console.error('Erro ao registrar login log:', err)
  }

  const loginValue = String(usuario.email ?? usuario.username ?? '')
  const nomeValue = String(usuario.nome ?? loginValue)

  const token = await gerarToken({
    id: userId,
    username: loginValue,
    nome: nomeValue,
    perfil: String(usuario.perfil ?? 'Técnico'),
  })

  return c.json({
    token,
    user: {
      id: usuario._id,
      email: usuario.email ?? undefined,
      username: usuario.username ?? undefined,
      nome: usuario.nome,
      perfil: usuario.perfil,
    },
  })
})

auth.post('/forgot-password', async (c) => {
  const { email } = await c.req.json<{ email: string }>()
  if (!email?.trim()) return c.json({ error: 'E-mail obrigatório' }, 400)

  const usuarios = await listar('usuarios', { email: email.trim().toLowerCase() })
  // Responde sempre com sucesso para não revelar se o e-mail existe
  if (usuarios.length === 0) return c.json({ message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' })

  const usuario = usuarios[0]
  const { createHmac } = await import('crypto')
  const secret = process.env.JWT_SECRET ?? 'dev-secret'
  const token = createHmac('sha256', secret)
    .update(`${usuario._id}:reset:${Date.now()}`)
    .digest('hex')

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  await atualizar('usuarios', String(usuario._id), { reset_token: token, reset_token_expires_at: expiresAt })

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const link = `${frontendUrl}/redefinir-senha?token=${token}`

  try {
    await enviarEmailResetSenha(String(usuario.email), String(usuario.nome), link)
  } catch (err) {
    console.error('Erro ao enviar e-mail de reset:', err)
  }

  return c.json({ message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' })
})

auth.post('/reset-password', async (c) => {
  const { token, novaSenha } = await c.req.json<{ token: string; novaSenha: string }>()

  if (!token || !novaSenha) return c.json({ error: 'Dados inválidos' }, 400)
  if (novaSenha.length < 6) return c.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, 400)

  const usuarios = await listar('usuarios', { reset_token: token })
  if (usuarios.length === 0) return c.json({ error: 'Link inválido ou já utilizado' }, 400)

  const usuario = usuarios[0]
  const expiresAt = new Date(String(usuario.reset_token_expires_at)).getTime()
  if (Date.now() > expiresAt) return c.json({ error: 'Link expirado. Solicite um novo.' }, 400)

  const senhaHash = await hashSenha(novaSenha)
  await atualizar('usuarios', String(usuario._id), {
    senha: senhaHash,
    reset_token: null,
    reset_token_expires_at: null,
  })

  return c.json({ message: 'Senha redefinida com sucesso!' })
})

auth.post('/register', async (c) => {
  const body = await c.req.json<{
    nome: string
    email: string
    username: string
    senha: string
    perfil?: string
  }>()

  const { nome, email, username, senha, perfil } = body

  if (!nome?.trim() || !email?.trim() || !username?.trim() || !senha) {
    return c.json({ error: 'Nome, e-mail, usuário e senha são obrigatórios' }, 400)
  }

  if (senha.length < 6) {
    return c.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, 400)
  }

  const [emailExistente, usernameExistente] = await Promise.all([
    listar('usuarios', { email: email.trim().toLowerCase() }),
    listar('usuarios', { username: username.trim() }),
  ])

  if (emailExistente.length > 0) return c.json({ error: 'Este e-mail já está cadastrado' }, 409)
  if (usernameExistente.length > 0) return c.json({ error: 'Este usuário já está em uso' }, 409)

  const senhaHash = await hashSenha(senha)
  const id = await inserir('usuarios', {
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    username: username.trim(),
    senha: senhaHash,
    perfil: perfil ?? 'Técnico',
    status: 'pendente',
  })

  const novoUsuario = { _id: id, nome: nome.trim(), email: email.trim().toLowerCase(), username: username.trim(), perfil: perfil ?? 'Técnico' }

  try {
    await Promise.all([
      enviarEmailCadastroRecebido(novoUsuario),
      enviarEmailAdminNovoCadastro(novoUsuario),
    ])
  } catch (err) {
    console.error('Erro ao enviar e-mails de cadastro:', err)
  }

  return c.json({ message: 'Cadastro realizado com sucesso! Aguarde a aprovação.' }, 201)
})

auth.use('/usuarios/*', authMiddleware)
auth.use('/usuarios', authMiddleware)
auth.use('/login-logs', authMiddleware)

auth.get('/usuarios', async (c) => {
  const user = c.get('user')
  if (user.perfil !== 'Administrador' && user.perfil !== 'Admin') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403)
  }
  const usuarios = await listar('usuarios', {}, [['criado_em', -1]])
  return c.json(
    usuarios.map((u) => ({
      id: u._id,
      nome: u.nome,
      email: u.email,
      username: u.username,
      perfil: u.perfil,
      status: u.status ?? 'aprovado',
      criado_em: u.criado_em,
    }))
  )
})

auth.get('/login-logs', async (c) => {
  const user = c.get('user')
  if (user.perfil !== 'Administrador' && user.perfil !== 'Admin') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403)
  }
  const logs = await listar('login_logs', {}, [['criado_em', -1]])
  return c.json(logs.map(l => ({
    id: l._id,
    usuario_nome: l.usuario_nome,
    latitude: l.latitude,
    longitude: l.longitude,
    endereco: l.endereco,
    criado_em: l.criado_em,
  })))
})

auth.put('/usuarios/:id', async (c) => {
  const user = c.get('user')
  if (user.perfil !== 'Administrador' && user.perfil !== 'Admin') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403)
  }

  const id = c.req.param('id')
  const { nome, email, username, perfil, novaSenha } = await c.req.json<{
    nome?: string
    email?: string
    username?: string
    perfil?: string
    novaSenha?: string
  }>()

  const usuario = await buscarPorId('usuarios', id)
  if (!usuario) return c.json({ error: 'Usuário não encontrado' }, 404)

  const campos: Record<string, unknown> = {}
  if (nome?.trim()) campos.nome = nome.trim()
  if (email?.trim()) {
    const existente = await listar('usuarios', { email: email.trim().toLowerCase() })
    if (existente.length > 0 && String(existente[0]._id) !== id) {
      return c.json({ error: 'Este e-mail já está em uso' }, 409)
    }
    campos.email = email.trim().toLowerCase()
  }
  if (username?.trim()) {
    const existente = await listar('usuarios', { username: username.trim() })
    if (existente.length > 0 && String(existente[0]._id) !== id) {
      return c.json({ error: 'Este usuário já está em uso' }, 409)
    }
    campos.username = username.trim()
  }
  if (perfil) campos.perfil = perfil
  if (novaSenha) {
    if (novaSenha.length < 6) return c.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, 400)
    campos.senha = await hashSenha(novaSenha)
  }

  if (Object.keys(campos).length === 0) return c.json({ error: 'Nenhum campo para atualizar' }, 400)

  await atualizar('usuarios', id, campos)
  return c.json({ message: 'Usuário atualizado com sucesso' })
})

auth.put('/usuarios/:id/aprovar', async (c) => {
  const user = c.get('user')
  if (user.perfil !== 'Administrador' && user.perfil !== 'Admin') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403)
  }
  const id = c.req.param('id')
  const usuario = await buscarPorId('usuarios', id)
  if (!usuario) return c.json({ error: 'Usuário não encontrado' }, 404)
  await atualizar('usuarios', id, { status: 'aprovado', motivo_rejeicao: null })
  try { await enviarEmailUsuarioAprovado(usuario) } catch (err) { console.error(err) }
  return c.json({ message: 'Usuário aprovado com sucesso' })
})

auth.put('/usuarios/:id/rejeitar', async (c) => {
  const user = c.get('user')
  if (user.perfil !== 'Administrador' && user.perfil !== 'Admin') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403)
  }
  const id = c.req.param('id')
  const { motivo } = await c.req.json<{ motivo?: string }>().catch(() => ({ motivo: undefined }))
  const usuario = await buscarPorId('usuarios', id)
  if (!usuario) return c.json({ error: 'Usuário não encontrado' }, 404)
  await atualizar('usuarios', id, { status: 'rejeitado', motivo_rejeicao: motivo ?? null })
  try { await enviarEmailUsuarioRejeitado(usuario, motivo) } catch (err) { console.error(err) }
  return c.json({ message: 'Usuário rejeitado' })
})

export default auth
