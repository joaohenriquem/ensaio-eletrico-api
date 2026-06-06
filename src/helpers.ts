import { ITENS_INSPECAO_VISUAL, ITENS_LIMPEZA, ITENS_REAPERTO } from './constants.js'

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TZ = 'America/Sao_Paulo'

export function dataHojeBR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

export function dataBr(dt: string | Date | null | undefined): string {
  if (!dt) return ''
  if (dt instanceof Date) return dt.toLocaleDateString('pt-BR', { timeZone: TZ })
  if (typeof dt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dt)) {
    const [y, m, d] = dt.split('T')[0].split('-')
    return `${d}/${m}/${y}`
  }
  return String(dt)
}

export interface PainelChecklist {
  [key: string]: string
}

export interface VerificacaoEletrica {
  medicao_tensao: string
  medicao_corrente: string
  equilibrio_fases: string
  continuidade_condutor_pe: string
}

export interface Painel {
  nome: string
  tipo: string
  inspecao_visual: PainelChecklist
  limpeza_tecnica: PainelChecklist
  reaperto_mecanico: PainelChecklist
  verificacao_eletrica: VerificacaoEletrica
  nao_conformidades: string
  recomendacoes: string
}

export function painelVazio(nome = 'Novo Painel'): Painel {
  const conformeTodos = (itens: Record<string, string>): PainelChecklist =>
    Object.fromEntries(Object.keys(itens).map((k) => [k, 'conforme']))

  return {
    nome,
    tipo: 'Térreo',
    inspecao_visual: conformeTodos(ITENS_INSPECAO_VISUAL),
    limpeza_tecnica: conformeTodos(ITENS_LIMPEZA),
    reaperto_mecanico: conformeTodos(ITENS_REAPERTO),
    verificacao_eletrica: {
      medicao_tensao: '220V',
      medicao_corrente: '',
      equilibrio_fases: 'conforme',
      continuidade_condutor_pe: 'conforme',
    },
    nao_conformidades: '',
    recomendacoes: '',
  }
}

export const OBJETIVO_PADRAO =
  'Realizar manutenção preventiva em painéis elétricos com o objetivo de garantir a segurança, confiabilidade operacional, ' +
  'continuidade do fornecimento de energia e prevenção de falhas. Também apontar melhorias para segurança de acordo com as normas ' +
  'vigentes, observando e propondo ações corretivas quando houver necessidade. Por fim, executar troca de lâmpadas queimadas, ' +
  'fotocélula, sensores de presença e até mesmo tomadas 10A/20A que apresentar defeito.'

export const CONCLUSAO_PADRAO =
  'Após a manutenção preventiva, os painéis elétricos encontram-se em condições operacionais seguras, com necessidade de ajustes ' +
  'pontuais conforme descrito nas não conformidades. Foi verificado circuitos de iluminação das áreas comuns e efetuado troca de ' +
  'lâmpadas queimadas. Também foi identificado um cabo aparente e efetuado a devida isolação do mesmo. As devidas recomendações ' +
  'seguirão de propostas corretivas havendo solicitação das mesmas.'
