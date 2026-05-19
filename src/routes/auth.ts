import { Hono } from 'hono'
import { listar } from '../db.js'
import { verificarSenha, gerarToken } from '../auth.js'

const auth = new Hono()

auth.post('/login', async (c) => {
  const { email, username, password } = await c.req.json<{ email?: string; username?: string; password: string }>()
  const login = String(email ?? username ?? '').trim()

  if (!login || !password) {
    return c.json({ error: 'E-mail/usuário e senha são obrigatórios' }, 400)
  }

  let usuarios = await listar('usuarios', { email: login })
  if (usuarios.length === 0) {
    usuarios = await listar('usuarios', { username: login })
  }
  if (usuarios.length === 0) {
    return c.json({ error: 'Usuário ou senha inválidos' }, 401)
  }

  const usuario = usuarios[0]
  const senhaCorreta = await verificarSenha(password, String(usuario.senha))
  if (!senhaCorreta) {
    return c.json({ error: 'Usuário ou senha inválidos' }, 401)
  }

  const token = await gerarToken({
    id: String(usuario._id),
    username: String(usuario.email),
    nome: String(usuario.nome ?? usuario.email),
    perfil: String(usuario.perfil ?? 'Técnico'),
  })

  return c.json({
    token,
    user: {
      id: usuario._id,
      email: usuario.email,
      nome: usuario.nome,
      perfil: usuario.perfil,
    },
  })
})

export default auth
