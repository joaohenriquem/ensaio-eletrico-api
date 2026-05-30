import { describe, it, expect } from 'vitest'
import { gerarTokenAcao } from '../mailer.js'

describe('gerarTokenAcao', () => {
  it('gera token de 32 caracteres', () => {
    const token = gerarTokenAcao('abc123', 'aprovar')
    expect(token).toHaveLength(32)
  })

  it('gera token diferente para ações diferentes', () => {
    const t1 = gerarTokenAcao('abc123', 'aprovar')
    const t2 = gerarTokenAcao('abc123', 'reprovar')
    expect(t1).not.toBe(t2)
  })

  it('gera token diferente para IDs diferentes', () => {
    const t1 = gerarTokenAcao('id1', 'aprovar')
    const t2 = gerarTokenAcao('id2', 'aprovar')
    expect(t1).not.toBe(t2)
  })

  it('gera token determinístico (mesmo input = mesmo output)', () => {
    const t1 = gerarTokenAcao('abc123', 'aprovar')
    const t2 = gerarTokenAcao('abc123', 'aprovar')
    expect(t1).toBe(t2)
  })

  it('token contém apenas caracteres hexadecimais', () => {
    const token = gerarTokenAcao('abc123', 'aprovar')
    expect(token).toMatch(/^[0-9a-f]+$/)
  })
})
