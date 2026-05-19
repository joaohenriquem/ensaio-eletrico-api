import { Hono } from 'hono'
import { listar, inserir, buscarPorId, atualizar } from '../db.js'
import { verificarSenha, gerarToken, hashSenha, authMiddleware } from '../auth.js'
import type { JwtPayload } from '../auth.js'
import {
  enviarEmailCadastroRecebido,
  enviarEmailAdminNovoCadastro,
  enviarEmailUsuarioAprovado,
  enviarEmailUsuarioRejeitado,
} from '../mailer.js'

const auth = new Hono<{ Variables: { user: JwtPayload } }>()

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

  const loginValue = String(usuario.email ?? usuario.username ?? '')
  const nomeValue = String(usuario.nome ?? loginValue)

  const token = await gerarToken({
    id: String(usuario._id),
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

  if (emailExistente.length > 0) {
    return c.json({ error: 'Este e-mail já está cadastrado' }, 409)
  }
  if (usernameExistente.length > 0) {
    return c.json({ error: 'Este usuário já está em uso' }, 409)
  }

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

// Rotas de administração — exigem auth + perfil Administrador
auth.use('/usuarios/*', authMiddleware)
auth.use('/usuarios', authMiddleware)

auth.get('/usuarios', async (c) => {
  const user = c.get('user') as JwtPayload
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

auth.put('/usuarios/:id/aprovar', async (c) => {
  const user = c.get('user') as JwtPayload
  if (user.perfil !== 'Administrador' && user.perfil !== 'Admin') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403)
  }

  const id = c.req.param('id')
  const usuario = await buscarPorId('usuarios', id)
  if (!usuario) return c.json({ error: 'Usuário não encontrado' }, 404)

  await atualizar('usuarios', id, { status: 'aprovado', motivo_rejeicao: null })

  try {
    await enviarEmailUsuarioAprovado(usuario)
  } catch (err) {
    console.error('Erro ao enviar e-mail de aprovação:', err)
  }

  return c.json({ message: 'Usuário aprovado com sucesso' })
})

auth.put('/usuarios/:id/rejeitar', async (c) => {
  const user = c.get('user') as JwtPayload
  if (user.perfil !== 'Administrador' && user.perfil !== 'Admin') {
    return c.json({ error: 'Acesso restrito a administradores' }, 403)
  }

  const id = c.req.param('id')
  const { motivo } = await c.req.json<{ motivo?: string }>().catch(() => ({ motivo: undefined }))

  const usuario = await buscarPorId('usuarios', id)
  if (!usuario) return c.json({ error: 'Usuário não encontrado' }, 404)

  await atualizar('usuarios', id, { status: 'rejeitado', motivo_rejeicao: motivo ?? null })

  try {
    await enviarEmailUsuarioRejeitado(usuario, motivo)
  } catch (err) {
    console.error('Erro ao enviar e-mail de rejeição:', err)
  }

  return c.json({ message: 'Usuário rejeitado' })
})

export default auth
