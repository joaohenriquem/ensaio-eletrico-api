import { describe, it, expect } from 'vitest'
import { painelVazio } from '../helpers.js'
import { ITENS_INSPECAO_VISUAL, ITENS_LIMPEZA, ITENS_REAPERTO } from '../constants.js'

describe('painelVazio', () => {
  it('cria painel com nome padrão', () => {
    const p = painelVazio()
    expect(p.nome).toBe('Novo Painel')
  })

  it('cria painel com nome customizado', () => {
    const p = painelVazio('Painel Principal')
    expect(p.nome).toBe('Painel Principal')
  })

  it('todos os itens de inspeção visual iniciam como conforme', () => {
    const p = painelVazio()
    for (const key of Object.keys(ITENS_INSPECAO_VISUAL)) {
      expect(p.inspecao_visual[key]).toBe('conforme')
    }
  })

  it('todos os itens de limpeza iniciam como conforme', () => {
    const p = painelVazio()
    for (const key of Object.keys(ITENS_LIMPEZA)) {
      expect(p.limpeza_tecnica[key]).toBe('conforme')
    }
  })

  it('todos os itens de reaperto iniciam como conforme', () => {
    const p = painelVazio()
    for (const key of Object.keys(ITENS_REAPERTO)) {
      expect(p.reaperto_mecanico[key]).toBe('conforme')
    }
  })

  it('verificação elétrica tem tensão padrão', () => {
    const p = painelVazio()
    expect(p.verificacao_eletrica.medicao_tensao).toBe('220V')
  })

  it('verificação elétrica tem equilíbrio de fases como conforme', () => {
    const p = painelVazio()
    expect(p.verificacao_eletrica.equilibrio_fases).toBe('conforme')
  })

  it('tipo padrão é Térreo', () => {
    const p = painelVazio()
    expect(p.tipo).toBe('Térreo')
  })

  it('nao_conformidades começa vazio', () => {
    const p = painelVazio()
    expect(p.nao_conformidades).toBe('')
  })
})
