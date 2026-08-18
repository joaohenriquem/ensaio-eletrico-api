import PDFDocument from 'pdfkit'
import path from 'path'
import { fileURLToPath } from 'url'
import { EMPRESA } from '../constants.js'
import { dataBr, formatarMoeda } from '../helpers.js'
import { desenharCapa } from './capa.js'

async function resolverImagem(src: string): Promise<Buffer | null> {
  if (!src) return null
  try {
    if (src.startsWith('data:')) {
      return Buffer.from(src.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    }
    const r = await fetch(src)
    if (!r.ok) return null
    return Buffer.from(await r.arrayBuffer())
  } catch { return null }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOGO_PATH = path.resolve(__dirname, '../static/logo.jpeg')
const EQUIPE_PATH = path.resolve(__dirname, '../static/equipe.png')

// Paleta seguindo o modelo enviado
const COR_AZUL = '#1a4b9c'
const COR_TABELA = '#31849b'
const COR_CINZA = '#eef4f7'
const COR_BRANCO = '#ffffff'
const COR_BORDA = '#cccccc'
const COR_TEXTO = '#222222'

const MARGEM = 45
const LARGURA_PAGINA = 595 - MARGEM * 2

// Cabeçalho do modelo: apenas o logo pequeno no canto superior direito
function cabecalhoPagina(doc: PDFKit.PDFDocument) {
  doc.save()
  try {
    doc.image(LOGO_PATH, MARGEM + LARGURA_PAGINA - 30, 18, { height: 30 })
  } catch { /* ignora */ }
  doc.restore()
}

function tituloAzul(doc: PDFKit.PDFDocument, texto: string, opts?: { centrado?: boolean }) {
  if (doc.y > 690) doc.addPage()
  doc.moveDown(0.6)
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COR_AZUL)
    .text(texto, MARGEM, doc.y, { width: LARGURA_PAGINA, align: opts?.centrado ? 'center' : 'left' })
  doc.moveDown(0.35)
}

function subtituloBold(doc: PDFKit.PDFDocument, texto: string) {
  if (doc.y > 700) doc.addPage()
  doc.moveDown(0.35)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COR_TEXTO).text(texto, MARGEM, doc.y, { width: LARGURA_PAGINA })
  doc.moveDown(0.15)
}

function corpo(doc: PDFKit.PDFDocument, texto: string, opts?: { negrito?: boolean; x?: number; largura?: number }) {
  doc
    .font(opts?.negrito ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(9.5)
    .fillColor(COR_TEXTO)
    .text(texto, opts?.x ?? MARGEM, doc.y, { lineGap: 2.5, width: opts?.largura ?? LARGURA_PAGINA })
  doc.moveDown(0.3)
}

function bullet(doc: PDFKit.PDFDocument, texto: string) {
  doc.font('Helvetica').fontSize(9.5).fillColor(COR_TEXTO)
    .text(`•  ${texto}`, MARGEM + 10, doc.y, { lineGap: 2, width: LARGURA_PAGINA - 10 })
  doc.moveDown(0.1)
}

function fmtDataHora(v: unknown): string | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(String(v))
  if (isNaN(d.getTime())) return null
  const data = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  return `${data} às ${hora}`
}

export async function gerarPdfContrato(contrato: Record<string, unknown>): Promise<Buffer> {
  const assinContratadaBuf = await resolverImagem(String(contrato.assinatura_contratada ?? ''))
  const assinContratanteBuf = await resolverImagem(String(contrato.assinatura_contratante ?? ''))

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 45, left: MARGEM, right: MARGEM },
      info: { Title: `Contrato ${contrato.numero}`, Author: EMPRESA.nome },
    })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.on('pageAdded', () => cabecalhoPagina(doc))

    const qtd = Number(contrato.qtd_paineis ?? 0)
    const locais = String(contrato.locais_paineis ?? '')
    const qtdManut = Number(contrato.qtd_manutencoes ?? 0)
    const valorTotal = Number(contrato.valor_total ?? 0)
    const formaPagamento = String(contrato.forma_pagamento ?? '')
    const vigenciaMeses = Number(contrato.vigencia_meses ?? 0)
    const dataInicio = dataBr(contrato.data_inicio as string | Date)
    const dataFim = dataBr(contrato.data_fim as string | Date)
    const taxaVisita = Number(contrato.taxa_visita ?? 200)
    const responsavel = String(contrato.responsavel_tecnico ?? '')
    const cft = String(contrato.cft ?? EMPRESA.cft)

    // ── CAPA (padrão já definido) ─────────────────────────────────────────
    cabecalhoPagina(doc)
    desenharCapa(doc, {
      titulo: 'CONTRATO DE MANUTENÇÃO ELÉTRICA',
      cliente: String(contrato.cliente_nome ?? ''),
      local: String(contrato.cliente_endereco ?? ''),
      data: dataBr(contrato.data as string | Date),
    })
    doc.addPage()

    // ── PROPOSTA TÉCNICA E COMERCIAL ──────────────────────────────────────
    tituloAzul(doc, 'Proposta Técnica e Comercial', { centrado: true })

    subtituloBold(doc, 'Resumo Profissional')
    corpo(
      doc,
      'Profissional com mais de 12 anos de experiência em manutenção e instalações elétricas, atuando em projetos ' +
        'residenciais, corporativos e comerciais de grande porte. Formação sólida e multidisciplinar, com destaque para a ' +
        'formação técnica em Eletrotécnica e o curso de Eletricista Instalador pelo SENAI, complementada por ' +
        'especializações em NR10, NR33 e NR35, garantindo conformidade com as normas de segurança.\n' +
        'Engenharia Elétrica pela Universidade Anhembi Morumbi, unindo conhecimento acadêmico à prática adquirida em campo.'
    )

    subtituloBold(doc, 'Diferenciais Profissionais')
    bullet(doc, 'Experiência em manutenção preventiva e corretiva em empresas como Smart Fit, Riachuelo e Fast Shop, incluindo serviços de cabines primárias e subestações.')
    bullet(doc, 'Histórico de atuação em gestão de manutenção elétrica residencial de alto padrão, abrangendo sistemas elétricos de controle por automação.')
    bullet(doc, 'Conhecimentos complementares em logística, administração e finanças, agregando visão de gestão e planejamento a projetos técnicos.')
    bullet(doc, 'Certificações em segurança, primeiros socorros e brigada de incêndio, transmitindo maior confiabilidade para serviços em ambientes de risco.')
    bullet(doc, 'Idiomas: Português e Italiano (fluente).')

    subtituloBold(doc, 'Formação Técnica e Acadêmica')
    bullet(doc, 'Técnico em Eletrotécnica – Instituto Thomas Edson')
    bullet(doc, 'Curso de Eletricista Instalador – SENAI')
    bullet(doc, 'Cursos de NR10, NR33, NR35 – Segurança em Instalações Elétricas, Espaços Confinados e Trabalho em Altura')
    bullet(doc, 'Engenharia Elétrica – Universidade Anhembi Morumbi')
    bullet(doc, 'Projetista de Elite – CFPRO – Centro de Formação de Projetistas')
    bullet(doc, 'Projeto e Instalação de Estações de Recargas – CPERX Treinamentos')

    // ── SOBRE A EMPRESA (texto à esquerda + foto da equipe à direita) ─────
    const FOTO_W = 200
    const FOTO_H = 205
    const COL_TEXTO_W = LARGURA_PAGINA - FOTO_W - 16

    if (doc.y + FOTO_H + 40 > doc.page.height - doc.page.margins.bottom) doc.addPage()

    tituloAzul(doc, 'Sobre a empresa:')
    const topoEmpresa = doc.y

    corpo(
      doc,
      'Contamos com uma equipe técnica qualificada e certificada, equipada com ferramentas especializadas e o uso ' +
        'adequado de EPIs, garantindo a execução dos serviços com segurança, eficiência e conformidade com as normas vigentes.',
      { largura: COL_TEXTO_W }
    )
    doc.moveDown(0.4)

    const dadosEmpresa: [string, string][] = [
      ['CNPJ: ', EMPRESA.cnpj],
      ['CFT: ', EMPRESA.cft],
      ['Telefone: ', EMPRESA.tel],
      ['Site: ', `${EMPRESA.site}  Instagram: ${EMPRESA.instagram}`],
    ]
    dadosEmpresa.forEach(([rotulo, valor]) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COR_TEXTO)
        .text(rotulo, MARGEM, doc.y, { continued: true, width: COL_TEXTO_W })
      doc.font('Helvetica').text(valor, { width: COL_TEXTO_W })
    })
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COR_TEXTO).text("E-mail's:", MARGEM, doc.y, { width: COL_TEXTO_W })
    doc.font('Helvetica').fontSize(9)
      .text('amauri@ensaioeletrico.com.br', MARGEM, doc.y, { width: COL_TEXTO_W })
      .text('gustavo.hardaim@ensaioeletrico.com.br', MARGEM, doc.y, { width: COL_TEXTO_W })
      .text('nilson.garcia@ensaioeletrico.com.br', MARGEM, doc.y, { width: COL_TEXTO_W })

    try {
      doc.image(EQUIPE_PATH, MARGEM + COL_TEXTO_W + 16, topoEmpresa, { fit: [FOTO_W, FOTO_H] })
    } catch { /* ignora foto ausente */ }

    doc.y = Math.max(doc.y, topoEmpresa + FOTO_H) + 10

    // ── INFORMAÇÕES CLIENTE ───────────────────────────────────────────────
    tituloAzul(doc, 'Informações Cliente')
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COR_TEXTO)
      .text('Condomínio: ', MARGEM, doc.y, { continued: true, width: LARGURA_PAGINA })
    doc.font('Helvetica').text(String(contrato.cliente_nome ?? ''), { width: LARGURA_PAGINA })
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COR_TEXTO)
      .text('Endereço: ', MARGEM, doc.y, { continued: true, width: LARGURA_PAGINA })
    doc.font('Helvetica').text(String(contrato.cliente_endereco ?? ''), { width: LARGURA_PAGINA })

    // ── OBJETIVO ─────────────────────────────────────────────────────────
    doc.addPage()
    tituloAzul(doc, 'Objetivo da Proposta')
    corpo(doc, `Solução de manutenção preventiva em (${qtd}) Painéis elétricos nos locais: ${locais}.`)

    // ── ESCOPO ────────────────────────────────────────────────────────────
    tituloAzul(doc, 'Escopo dos Serviços')
    corpo(
      doc,
      'Executar limpeza, reaperto das conexões e medições de tensão e corrente na saída do disjuntor geral, afim de ' +
        'assegurar o bom funcionamento das instalações e apontar as devidas correções e melhorias se necessário.'
    )
    corpo(doc, 'Observação:', { negrito: true })
    corpo(
      doc,
      'Havendo equipamento/dispositivos ou circuito apresentando falha técnica, contatação de não enquadro das normas ' +
        'atuais ou sistema inoperante de instalação, será apresentado uma solução de troca, ajuste, nova instalação ou ' +
        'melhoria mediante uma proposta de manutenção corretiva, conforme os devidos parâmetros estabelecidos na ABNT ' +
        'norma 5410 e NR-10.'
    )

    // ── CLÁUSULAS ─────────────────────────────────────────────────────────
    tituloAzul(doc, 'CLÁUSULA 1 – OBJETO DO CONTRATO')
    corpo(
      doc,
      'O presente contrato tem por objeto a prestação de serviços de manutenção preventiva em painéis elétricos de baixa ' +
        'tensão, conforme recomendações da ABNT NBR 5410, visando:'
    )
    corpo(
      doc,
      'Garantir segurança elétrica; Evitar falhas e paradas operacionais; Preservar a vida útil dos equipamentos; Manter a ' +
        'conformidade normativa das instalações.'
    )
    corpo(doc, `Os serviços serão realizados nos seguintes (${qtd}) painéis elétricos:`)
    corpo(
      doc,
      'QGBT – Quadro Geral de Baixa Tensão; QDC – Quadro de distribuição de circuitos; QDL – Quadros de distribuição de ' +
        'iluminação; QDF – Quadros de força.'
    )

    tituloAzul(doc, 'CLÁUSULA 2 – SERVIÇOS INCLUÍDOS')
    corpo(doc, 'A manutenção preventiva incluirá:')
    corpo(
      doc,
      'Inspeção Visual - Verificação de aquecimento anormal; Integridade de barramentos; Estado de disjuntores; Estado ' +
        'de cabos e isolação; Identificação e sinalização dos circuitos.'
    )
    corpo(doc, 'Limpeza Técnica - Remoção de poeira e contaminantes; Limpeza de barramentos; Limpeza de componentes elétricos.')
    corpo(doc, 'Reaperto Mecânico - Reaperto de bornes; Reaperto de barramentos; Reaperto de disjuntores e contatores.')
    corpo(
      doc,
      'Verificação Elétrica - Medição de tensão; Medição de corrente; Verificação de equilíbrio de fases; Teste de ' +
        'continuidade do condutor de proteção (PE).'
    )
    corpo(doc, 'Termografia (quando contratado)')
    corpo(doc, 'Inspeção por câmera termográfica; Identificação de pontos quentes')
    corpo(doc, 'Testes Operacionais - Teste de disjuntores; Teste de dispositivos DR; Teste de comandos.')

    tituloAzul(doc, 'CLÁUSULA 3 – PERIODICIDADE DA MANUTENÇÃO')
    corpo(doc, 'A manutenção preventiva será realizada com a seguinte frequência:')
    corpo(doc, String(contrato.periodicidade ?? ''))

    tituloAzul(doc, 'CLÁUSULA 4 – RELATÓRIO TÉCNICO')
    corpo(doc, 'Após cada manutenção, a CONTRATADA fornecerá:')
    corpo(
      doc,
      'Relatório técnico detalhado; Registro fotográfico; Medições elétricas; Lista de não conformidades; Recomendações de correção.'
    )

    tituloAzul(doc, 'CLÁUSULA 5 – OBRIGAÇÕES DA CONTRATADA')
    corpo(doc, 'A CONTRATADA se compromete a:')
    corpo(
      doc,
      `Executar os (${qtdManut}) serviços de manutenção preventiva durante o período vigente deste contrato, considerando ` +
        'as normas técnicas; Utilizar profissionais qualificados; Seguir procedimentos de segurança; Utilizar instrumentos ' +
        'calibrados; Em caso de chamado para atendimento emergencial, a contratada terá entre 24horas até 48 horas para ' +
        'chegar ao local.'
    )

    tituloAzul(doc, 'CLÁUSULA 6 – OBRIGAÇÕES DO CONTRATANTE')
    corpo(doc, 'O CONTRATANTE deverá:')
    corpo(
      doc,
      'Permitir acesso aos painéis elétricos; Informar condições operacionais da instalação; Providenciar desligamentos ' +
        'quando necessário; Garantir condições de segurança no local.'
    )

    if (doc.y > 600) doc.addPage()
    tituloAzul(doc, 'CLÁUSULA 7 – VALOR DO CONTRATO')
    corpo(doc, 'Pelos serviços prestados, o CONTRATANTE pagará à CONTRATADA o valor de:')

    // tabela no estilo do modelo (cabeçalho azul-petróleo)
    const COL_DESC = LARGURA_PAGINA * 0.32
    const COL_VAL = LARGURA_PAGINA * 0.68
    const ALT_LINHA = 20
    let iy = doc.y + 2

    doc.rect(MARGEM, iy, LARGURA_PAGINA, ALT_LINHA).fill(COR_TABELA)
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COR_BRANCO)
    doc.text('Descrição', MARGEM + 8, iy + 5, { width: COL_DESC - 8 })
    doc.text('Valor Total (R$)', MARGEM + COL_DESC, iy + 5, { width: COL_VAL - 8, align: 'center' })
    iy += ALT_LINHA

    doc.rect(MARGEM, iy, LARGURA_PAGINA, ALT_LINHA).fill(COR_CINZA)
    doc.rect(MARGEM, iy, LARGURA_PAGINA, ALT_LINHA).stroke(COR_BORDA).lineWidth(0.3)
    doc.font('Helvetica').fontSize(9.5).fillColor(COR_TEXTO)
    doc.text('Serviço Total', MARGEM + 8, iy + 5, { width: COL_DESC - 8 })
    doc.text(formatarMoeda(valorTotal), MARGEM + COL_DESC, iy + 5, { width: COL_VAL - 8, align: 'center' })
    iy += ALT_LINHA

    doc.rect(MARGEM, iy, LARGURA_PAGINA, ALT_LINHA).fill(COR_BRANCO)
    doc.rect(MARGEM, iy, LARGURA_PAGINA, ALT_LINHA).stroke(COR_BORDA).lineWidth(0.3)
    doc.font('Helvetica').fontSize(9.5).fillColor(COR_TEXTO)
    doc.text('Forma de Pagamento', MARGEM + 8, iy + 5, { width: COL_DESC - 8 })
    doc.text(formaPagamento, MARGEM + COL_DESC, iy + 5, { width: COL_VAL - 8, align: 'center' })
    iy += ALT_LINHA
    doc.y = iy + 10

    corpo(doc, 'Banco Inter', { negrito: true })
    corpo(doc, 'Agência: 0001')
    corpo(doc, 'Conta Corrente: 47093601-0')
    corpo(doc, `Chave Pix (CNPJ): ${EMPRESA.pix}`)

    tituloAzul(doc, 'CLÁUSULA 8 – PRAZO DE VIGÊNCIA')
    corpo(doc, 'Este contrato terá duração de:')
    corpo(
      doc,
      `${vigenciaMeses} meses, iniciando a partir do dia ${dataInicio} e encerrando em ${dataFim}. Podendo ser renovado ` +
        'mediante acordo entre as partes.'
    )

    tituloAzul(doc, 'CLÁUSULA 9 – RESCISÃO')
    corpo(doc, 'O contrato poderá ser rescindido:')
    corpo(doc, 'Por qualquer das partes com aviso prévio de 30 dias')
    corpo(
      doc,
      'Em caso de descumprimento desta cláusula contratual, a parte que estiver rescindindo pagará uma multa ' +
        'correspondente a 50% do valor restante previsto ao término deste contrato.'
    )

    tituloAzul(doc, 'CLÁUSULA 10 – RESPONSABILIDADE TÉCNICA')
    corpo(
      doc,
      'Os serviços serão executados sob responsabilidade técnica de profissional habilitado, com emissão de TRT (Termo ' +
        'de Responsabilidade Técnica).'
    )

    tituloAzul(doc, 'CLÁUSULA 11 – FORO')
    doc.font('Helvetica').fontSize(9.5).fillColor(COR_TEXTO)
      .text('Fica eleito o foro da comarca de ', MARGEM, doc.y, { continued: true, width: LARGURA_PAGINA })
      .text('OSASCO-SP', { continued: true, underline: true })
      .text(' para dirimir eventuais controvérsias.', { underline: false })
    doc.moveDown(0.3)

    // ── CRONOGRAMA / NORMAS / GARANTIA ────────────────────────────────────
    tituloAzul(doc, 'Cronograma')
    bullet(doc, `Tempo total de atividade: ${contrato.cronograma_tempo ?? ''}`)
    bullet(doc, `Horário de execução: ${contrato.cronograma_horario ?? ''}`)

    tituloAzul(doc, 'Normas Atendidas')
    corpo(doc, 'Todos os serviços serão realizados conforme as normas técnicas:')
    corpo(doc, 'NBR 5410 – Instalações Elétricas de Baixa Tensão;\nNR-10 – Segurança em Instalações e Serviços em Eletricidade;')

    tituloAzul(doc, 'Garantia')
    bullet(doc, 'Durante o todo o período de vigência deste contrato sobre a execução dos serviços.')
    bullet(doc, `Havendo abertura de chamado fora da data da preventiva, será cobrada a taxa de visita no valor de ${formatarMoeda(taxaVisita)}.`)

    // ── RESPONSÁVEL TÉCNICO + ASSINATURAS (estilo do modelo) ──────────────
    if (doc.y > 560) doc.addPage()
    doc.moveDown(1.2)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COR_AZUL)
      .text(`Responsável Técnico: ${responsavel} - CFT:${cft}`, MARGEM, doc.y, { width: LARGURA_PAGINA, underline: true })

    const nomeContratante = String(contrato.nome_contratante ?? '')
    const nomeContratada = String(contrato.nome_contratada ?? '')
    const LINHA_W = 300

    function linhaAssinatura(rotulo: string, buf: Buffer | null, nome: string, assinadoEm: string | null, localizacao: string | null) {
      doc.moveDown(2.2)
      const yLinha = doc.y + 26
      if (buf) {
        try {
          doc.image(buf, MARGEM + 150, yLinha - 44, { fit: [160, 42], align: 'center', valign: 'bottom' })
        } catch { /* ignore */ }
      }
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COR_AZUL)
        .text(`${rotulo} Assinatura: `, MARGEM, yLinha - 12, { continued: false })
      doc.moveTo(MARGEM + 140, yLinha)
        .lineTo(MARGEM + 140 + LINHA_W, yLinha)
        .strokeColor('#555').lineWidth(0.7).stroke()
      let yTexto = yLinha + 3
      if (nome) {
        doc.font('Helvetica').fontSize(8).fillColor('#555')
          .text(nome, MARGEM + 140, yTexto, { width: LINHA_W, align: 'center' })
        yTexto += 11
      }
      if (assinadoEm) {
        const texto = localizacao ? `Assinado em ${assinadoEm} — ${localizacao}` : `Assinado em ${assinadoEm}`
        doc.font('Helvetica').fontSize(7.5).fillColor('#888')
          .text(texto, MARGEM + 140, yTexto, { width: LINHA_W, align: 'center' })
        yTexto += 11
      }
      doc.y = Math.max(yLinha + 14, yTexto)
    }

    linhaAssinatura(
      'CONTRATANTE', assinContratanteBuf, nomeContratante,
      fmtDataHora(contrato.assinado_contratante_em), (contrato.endereco_contratante as string) || null
    )
    linhaAssinatura(
      'CONTRATADA', assinContratadaBuf, nomeContratada,
      fmtDataHora(contrato.assinado_contratada_em), (contrato.endereco_contratada as string) || null
    )

    doc.moveDown(1.6)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COR_AZUL)
      .text(`Local e data: Osasco, ${dataBr(contrato.data as string | Date)}`, MARGEM, doc.y, { underline: true })

    doc.end()
  })
}
