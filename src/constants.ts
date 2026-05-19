export const EMPRESA = {
  nome: 'ENSAIO ELÉTRICO',
  cnpj: '61.841.485/0001-30',
  cft: '38346090803',
  tel: '(11) 92137-4849 / (11) 98521-9614',
  site: 'www.ensaioeletrico.com.br',
  email: 'ensaioeletrico.servicos@gmail.com',
  instagram: '@ensaioeletrico',
  banco: 'Banco Inter · Ag: 0001 · CC: 47093601-0',
  pix: '61.841.485/0001-30',
  cidade: 'Osasco – SP',
}

export const NORMAS_PADRAO = [
  'NBR 5410 – Instalações Elétricas de Baixa Tensão em Edificações',
  'NR-10 – Segurança para Instalações e Serviços em Eletricidade',
  'NR-33 – Segurança e Saúde nos Trabalhos em Espaços Confinados',
  'NR-35 – Trabalho em Altura',
  'ABNT NBR 17019 – Requisitos para instalação de pontos de recarga de veículos elétricos',
  'IEC 61851 – Sistemas de recarga condutiva de veículos elétricos',
]

export const TIPOS_PAINEL = [
  'Subsolo',
  'Térreo',
  'Barrilete + B. Incêndio',
  'Guarita',
  'Cobertura',
  'Outro',
]

export const ITENS_INSPECAO_VISUAL: Record<string, string> = {
  verificacao_aquecimento: 'Verificação de Aquecimento',
  integridade_barramentos: 'Integridade dos Barramentos',
  estado_disjuntores: 'Estado dos Disjuntores',
  estado_cabos_isolacao: 'Estado de Cabos e Isolação',
  identificacao_circuitos: 'Identificação de Circuitos',
  acrilico_protecao: 'Acrílico de Proteção',
}

export const ITENS_LIMPEZA: Record<string, string> = {
  remocao_poeira: 'Remoção de Poeira',
  limpeza_barramentos: 'Limpeza de Barramentos',
  componentes_eletricos: 'Componentes Elétricos',
}

export const ITENS_REAPERTO: Record<string, string> = {
  reaperto_bornes: 'Reaperto de Bornes',
  reaperto_barramentos: 'Reaperto de Barramentos',
  reaperto_disjuntores: 'Reaperto de Disjuntores',
  reaperto_contatores: 'Reaperto de Contatores',
}

export const ITENS_VERIFICACAO_ELETRICA: Record<string, string> = {
  medicao_tensao: 'Medição de Tensão',
  medicao_corrente: 'Medição de Corrente',
  equilibrio_fases: 'Equilíbrio de Fases',
  continuidade_condutor_pe: 'Continuidade Condutor (PE)',
}

export const STATUS_OS: Record<string, string> = {
  aberta: '🟡 Aberta',
  em_andamento: '🔵 Em Andamento',
  concluida: '🟢 Concluída',
  cancelada: '🔴 Cancelada',
}

export const STATUS_PROPOSTA: Record<string, string> = {
  rascunho: '⚪ Rascunho',
  enviado: '🔵 Enviada',
  aprovado: '🟢 Aprovada',
  rejeitado: '🔴 Rejeitada',
}

export const STATUS_RELATORIO: Record<string, string> = {
  rascunho: '⚪ Rascunho',
  finalizado: '🟢 Finalizado',
}

export const CAMPOS_JSONB = [
  'paineis',
  'normas',
  'servicos',
  'materiais',
  'etapas',
  'investimento',
]

export const TIPOS_OS = [
  'Manutenção Preventiva',
  'Manutenção Corretiva',
  'Instalação Elétrica',
  'Instalação de Carregadores Veiculares',
  'Troca de Lâmpadas / Fotocélulas',
  'Inspeção Elétrica',
  'Projeto Elétrico',
  'Outro',
]
