import { Hono } from 'hono'
import { listar } from '../db.js'
import { verificarSenha, gerarToken } from '../auth.js'

const auth = new Hono()

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

export default auth
