import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { Context, Next } from 'hono'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-troque-em-producao'
)

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12)
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

export async function gerarToken(payload: { id: string; username: string; nome: string; perfil: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET)
}

export interface JwtPayload {
  id: string
  username: string
  nome: string
  perfil: string
}

export async function verificarToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET)
  return payload as unknown as JwtPayload
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Não autorizado' }, 401)
  }
  const token = header.slice(7)
  try {
    const payload = await verificarToken(token)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Token inválido ou expirado' }, 401)
  }
}
