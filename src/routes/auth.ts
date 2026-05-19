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

  let usuarios: Record<string, unknown>[] = []
  try {
    usuarios = await listar('usuarios', { email: login })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err)
    if (!/column .*email.*does not exist|42703/.test(mensagem)) {
      throw err
    }
  }

  if (usuarios.length === 0) {
    try {
      usuarios = await listar('usuarios', { username: login })
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err)
      if (/column .*username.*does not exist|42703/.test(mensagem)) {
        usuarios = []
      } else {
        throw err
      }
    }
  }

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
