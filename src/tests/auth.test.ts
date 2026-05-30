import { describe, it, expect } from 'vitest'
import { gerarToken, verificarToken, hashSenha, verificarSenha } from '../auth.js'

describe('gerarToken / verificarToken', () => {
  it('gera token válido', async () => {
    const token = await gerarToken({ id: '123', username: 'admin', nome: 'Admin', perfil: 'Administrador' })
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(10)
  })

  it('token gerado é verificável', async () => {
    const payload = { id: '456', username: 'tecnico', nome: 'Técnico', perfil: 'Técnico' }
    const token = await gerarToken(payload)
    const result = await verificarToken(token)
    expect(result.id).toBe('456')
    expect(result.username).toBe('tecnico')
    expect(result.perfil).toBe('Técnico')
  })

  it('tokens diferentes para payloads diferentes', async () => {
    const t1 = await gerarToken({ id: '1', username: 'a', nome: 'A', perfil: 'Admin' })
    const t2 = await gerarToken({ id: '2', username: 'b', nome: 'B', perfil: 'Técnico' })
    expect(t1).not.toBe(t2)
  })

  it('rejeita token inválido', async () => {
    await expect(verificarToken('token.invalido.aqui')).rejects.toThrow()
  })
})

describe('hashSenha / verificarSenha', () => {
  it('gera hash diferente da senha original', async () => {
    const hash = await hashSenha('minha_senha')
    expect(hash).not.toBe('minha_senha')
  })

  it('verifica senha correta', async () => {
    const hash = await hashSenha('senha123')
    const ok = await verificarSenha('senha123', hash)
    expect(ok).toBe(true)
  })

  it('rejeita senha incorreta', async () => {
    const hash = await hashSenha('senha123')
    const ok = await verificarSenha('outra_senha', hash)
    expect(ok).toBe(false)
  })

  it('hashes diferentes para a mesma senha (salt)', async () => {
    const h1 = await hashSenha('senha123')
    const h2 = await hashSenha('senha123')
    expect(h1).not.toBe(h2)
  })
})
