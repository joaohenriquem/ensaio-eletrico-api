import { describe, it, expect } from 'vitest'
import { formatarMoeda, dataBr } from '../helpers.js'

describe('formatarMoeda', () => {
  it('formata valor zero', () => {
    expect(formatarMoeda(0)).toContain('0')
  })

  it('formata valor inteiro', () => {
    const result = formatarMoeda(1500)
    expect(result).toContain('1.500')
  })

  it('formata valor com centavos', () => {
    const result = formatarMoeda(1234.56)
    expect(result).toContain('1.234')
  })

  it('inclui símbolo de moeda BRL', () => {
    const result = formatarMoeda(100)
    expect(result).toMatch(/R\$/)
  })
})

describe('dataBr', () => {
  it('retorna string vazia para null', () => {
    expect(dataBr(null)).toBe('')
  })

  it('retorna string vazia para undefined', () => {
    expect(dataBr(undefined)).toBe('')
  })

  it('formata data ISO corretamente', () => {
    expect(dataBr('2026-05-27')).toBe('27/05/2026')
  })

  it('formata data ISO com timestamp', () => {
    expect(dataBr('2026-01-15T10:00:00.000Z')).toBe('15/01/2026')
  })

  it('retorna o valor original se não for data ISO', () => {
    expect(dataBr('texto qualquer')).toBe('texto qualquer')
  })

  it('formata objeto Date', () => {
    const d = new Date('2026-03-10T00:00:00.000Z')
    const result = dataBr(d)
    expect(result).toMatch(/\d{2}\/\d{2}\/2026/)
  })
})
