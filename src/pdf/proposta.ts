import PDFDocument from 'pdfkit'
import path from 'path'
import { fileURLToPath } from 'url'
import { EMPRESA } from '../constants.js'
import { dataBr, formatarMoeda } from '../helpers.js'

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

const COR_AMARELO = '#f0a500'
const COR_ESCURO = '#1c1c2e'
const COR_CINZA = '#f5f5f5'
const COR_BRANCO = '#ffffff'
const COR_BORDA = '#cccccc'

const MARGEM = 40
const LARGURA_PAGINA = 595 - MARGEM * 2

function cabecalhoPagina(doc: PDFKit.PDFDocument, numero: string) {
  const y = doc.page.margins.top - 20
  doc.save()
  doc.rect(MARGEM, y - 4, LARGURA_PAGINA, 4).fill(COR_AMARELO)
  doc.image(LOGO_PATH, MARGEM, y + 2, { height: 14 })
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#555')
    .text(`PROPOSTA TÉCNICA COMERCIAL  |  ${numero}`, MARGEM, y + 4, {
      align: 'right',
      width: LARGURA_PAGINA,
    })
  doc.restore()
}

function secaoTitulo(doc: PDFKit.PDFDocument, texto: string) {
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COR_ESCURO).text(texto, MARGEM, doc.y, { width: LARGURA_PAGINA })
  doc
    .moveTo(MARGEM, doc.y + 2)
    .lineTo(MARGEM + LARGURA_PAGINA, doc.y + 2)
    .strokeColor(COR_AMARELO)
    .lineWidth(1)
    .stroke()
  doc.moveDown(0.4)
}

function corpo(doc: PDFKit.PDFDocument, texto: string) {
  doc.font('Helvetica').fontSize(9).fillColor('#111').text(texto, MARGEM, doc.y, { lineGap: 3, width: LARGURA_PAGINA })
  doc.moveDown(0.25)
}

function itemLista(doc: PDFKit.PDFDocument, texto: string, prefixo = '•') {
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#111')
    .text(`${prefixo} ${texto}`, MARGEM + 8, doc.y, { width: LARGURA_PAGINA - 8, lineGap: 2 })
}

export async function gerarPdfProposta(proposta: Record<string, unknown>): Promise<Buffer> {
  const assinSrc = String(proposta.assinatura ?? '')
  const assinContratadoSrc = String(proposta.assinatura_contratado ?? '')
  const [assinBuf, assinContratadoBuf] = await Promise.all([
    assinSrc ? resolverImagem(assinSrc) : Promise.resolve(null),
    assinContratadoSrc ? resolverImagem(assinContratadoSrc) : Promise.resolve(null),
  ])

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 40, left: MARGEM, right: MARGEM },
      info: { Title: `Proposta ${proposta.numero}`, Author: EMPRESA.nome },
    })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.on('pageAdded', () => {
      cabecalhoPagina(doc, String(proposta.numero ?? ''))
    })

    const servicos: string[] = Array.isArray(proposta.servicos) ? (proposta.servicos as string[]) : []
    const materiais: string[] = Array.isArray(proposta.materiais) ? (proposta.materiais as string[]) : []
    const etapas: string[] = Array.isArray(proposta.etapas) ? (proposta.etapas as string[]) : []
    const normas: string[] = Array.isArray(proposta.normas) ? (proposta.normas as string[]) : []
    const investimento: { descricao: string; valor: number }[] = Array.isArray(proposta.investimento)
      ? (proposta.investimento as { descricao: string; valor: number }[])
      : []

    // ── CAPA ─────────────────────────────────────────────────────────────
    const capaTopo = doc.y
    const boxH = 64

    // Fundo escuro
    doc.rect(MARGEM, capaTopo, LARGURA_PAGINA, boxH).fill(COR_ESCURO)

    // Logo à esquerda
    doc.image(LOGO_PATH, MARGEM + 8, capaTopo + 10, { height: 44 })

    // Nome da empresa e tipo de documento centralizados
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor(COR_AMARELO)
      .text('ENSAIO ELÉTRICO', MARGEM, capaTopo + 12, { width: LARGURA_PAGINA, align: 'center' })
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COR_BRANCO)
      .text('PROPOSTA TÉCNICA COMERCIAL', MARGEM, capaTopo + 38, {
        width: LARGURA_PAGINA,
        align: 'center',
      })

    doc.y = capaTopo + boxH + 8

    // Subtítulo serviço
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(COR_ESCURO)
      .text(String(proposta.descricao ?? ''), { align: 'center', width: LARGURA_PAGINA })
    doc.moveDown(0.5)

    // Dados de identificação — sem posicionamento absoluto para evitar sobreposição
    const rotulos = ['Cliente:', 'Endereço:', 'Data:', 'Proposta:']
    const valores = [
      String(proposta.cliente_nome ?? ''),
      String(proposta.cliente_endereco ?? ''),
      dataBr(proposta.data as string | Date),
      String(proposta.numero ?? ''),
    ]
    rotulos.forEach((rot, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COR_ESCURO)
        .text(rot, MARGEM, doc.y, { continued: true, width: 72 })
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#111')
        .text(valores[i], { width: LARGURA_PAGINA - 72 })
    })

    doc.moveDown(0.3)
    doc
      .moveTo(MARGEM, doc.y)
      .lineTo(MARGEM + LARGURA_PAGINA, doc.y)
      .strokeColor(COR_AMARELO)
      .lineWidth(1.5)
      .stroke()
    doc.moveDown(0.6)

    // ── RESUMO PROFISSIONAL ───────────────────────────────────────────────
    secaoTitulo(doc, 'RESUMO PROFISSIONAL')
    corpo(
      doc,
      'Profissional técnico em eletrotécnica com experiência em instalações elétricas de baixa tensão, manutenção preventiva e ' +
        'corretiva em condomínios residenciais e comerciais, instalação de carregadores veiculares (Wallbox), projetos elétricos ' +
        'e laudos técnicos com emissão de TRT. Atuação conforme NR-10, NR-33 e NR-35.'
    )

    // ── DIFERENCIAIS ─────────────────────────────────────────────────────
    secaoTitulo(doc, 'DIFERENCIAIS PROFISSIONAIS')
    const diferenciais = [
      `CFT ativo n.° ${EMPRESA.cft} – Conselho Federal dos Técnicos Industriais`,
      'Emissão de Relatório Técnico e TRT incluso no serviço',
      'EPIs e ferramentas certificadas para trabalho em eletricidade',
      'Equipe qualificada (NR-10, NR-33, NR-35)',
      'Atendimento transparente, pontual e com garantia por escrito',
      'Experiência comprovada em condomínios residenciais de grande porte',
    ]
    diferenciais.forEach((d) => itemLista(doc, d, '>>'))
    doc.moveDown(0.2)

    // ── FORMAÇÃO ─────────────────────────────────────────────────────────
    secaoTitulo(doc, 'FORMAÇÃO TÉCNICA E ACADÊMICA')
    const formacao = [
      'Engenharia Elétrica',
      'Técnico em Eletrotécnica – ETEC',
      'NR-10 Básico e SEP – Segurança em Instalações e Serviços em Eletricidade',
      'NR-33 – Segurança em Espaços Confinados',
      'NR-35 – Trabalho em Altura',
      `CFT n.° ${EMPRESA.cft} – Conselho Federal dos Técnicos Industriais`,
    ]
    formacao.forEach((f) => itemLista(doc, f))
    doc.moveDown(0.2)

    // ── SOBRE A EMPRESA ───────────────────────────────────────────────────
    secaoTitulo(doc, 'SOBRE A EMPRESA')
    corpo(
      doc,
      `A ${EMPRESA.nome} é uma empresa especializada em manutenção preventiva e corretiva de instalações elétricas, ` +
        'atuando em condomínios, comércios e indústrias. Contamos com equipe técnica certificada, equipamentos modernos ' +
        'e comprometimento total com a segurança e satisfação dos nossos clientes.'
    )
    const empresaDados = [
      [`CNPJ: ${EMPRESA.cnpj}`, `CFT: ${EMPRESA.cft}`],
      [`Tel: ${EMPRESA.tel}`, `Site: ${EMPRESA.site}`],
      [`E-mail: ${EMPRESA.email}`, `Instagram: ${EMPRESA.instagram}`],
    ]
    const colW = LARGURA_PAGINA / 2
    let ey = doc.y
    empresaDados.forEach((linha) => {
      doc.font('Helvetica').fontSize(8).fillColor('#333')
      doc.text(linha[0], MARGEM, ey, { width: colW - 4 })
      doc.text(linha[1], MARGEM + colW, ey, { width: colW - 4 })
      ey += 13
    })
    doc.y = ey + 6

    if (doc.y > 580) doc.addPage()

    // ── OBJETIVO ─────────────────────────────────────────────────────────
    secaoTitulo(doc, 'OBJETIVO DA PROPOSTA')
    corpo(doc, String(proposta.objetivo ?? ''))

    // ── SERVIÇOS ─────────────────────────────────────────────────────────
    secaoTitulo(doc, 'SERVIÇOS A SEREM EXECUTADOS')
    servicos.forEach((s, i) => itemLista(doc, s, `${i + 1}.`))
    doc.moveDown(0.2)

    // ── MATERIAIS NÃO INCLUSOS ────────────────────────────────────────────
    if (materiais.length > 0) {
      secaoTitulo(doc, 'ESCOPO DE MATERIAIS – NÃO INCLUSOS NA PROPOSTA')
      materiais.forEach((m) => itemLista(doc, m))
      doc.moveDown(0.2)
    }

    // ── CRONOGRAMA ────────────────────────────────────────────────────────
    if (etapas.length > 0) {
      if (doc.y > 580) doc.addPage()
      secaoTitulo(doc, 'ESCOPO DOS SERVIÇOS / CRONOGRAMA')
      etapas.forEach((etapa, i) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COR_ESCURO)
          .text(`Dia ${i + 1}: `, { continued: true })
        doc.font('Helvetica').fillColor('#111').text(etapa)
      })
      doc.moveDown(0.2)
    }

    // ── NORMAS ────────────────────────────────────────────────────────────
    secaoTitulo(doc, 'NORMAS ATENDIDAS')
    normas.forEach((n) => itemLista(doc, n))
    doc.moveDown(0.2)

    // ── PRAZO E GARANTIA ─────────────────────────────────────────────────
    secaoTitulo(doc, 'PRAZO DE EXECUÇÃO')
    corpo(doc, String(proposta.prazo ?? ''))

    secaoTitulo(doc, 'GARANTIA')
    const garantia = String(proposta.garantia ?? '')
    if (garantia) {
      corpo(doc, garantia)
    } else {
      itemLista(doc, 'Serviços: 24 meses sobre a execução.')
      itemLista(doc, 'Materiais: conforme fabricante.')
    }

    // ── TABELA DE INVESTIMENTO ────────────────────────────────────────────
    if (doc.y > 500) doc.addPage()
    secaoTitulo(doc, 'INVESTIMENTO')

    const COL_DESC = LARGURA_PAGINA * 0.75
    const COL_VAL = LARGURA_PAGINA * 0.25
    const ALTURA_HEADER = 20
    const ALTURA_LINHA = 18

    let iy = doc.y

    doc.rect(MARGEM, iy, LARGURA_PAGINA, ALTURA_HEADER).fill(COR_ESCURO)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COR_BRANCO)
    doc.text('Descrição', MARGEM + 6, iy + 6, { width: COL_DESC - 6 })
    doc.text('Valor do Serviço', MARGEM + COL_DESC, iy + 6, {
      width: COL_VAL - 6,
      align: 'center',
    })
    iy += ALTURA_HEADER

    const total = Number(proposta.total ?? 0)
    investimento.forEach((item, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : COR_CINZA
      doc.rect(MARGEM, iy, LARGURA_PAGINA, ALTURA_LINHA).fill(bg)
      doc.rect(MARGEM, iy, LARGURA_PAGINA, ALTURA_LINHA).stroke(COR_BORDA).lineWidth(0.3)
      doc.font('Helvetica').fontSize(9).fillColor('#111')
      doc.text(item.descricao, MARGEM + 6, iy + 5, { width: COL_DESC - 10, ellipsis: true })
      const valorStr = Number(item.valor) === 0 ? 'DESCONTO' : formatarMoeda(Number(item.valor))
      doc.text(valorStr, MARGEM + COL_DESC, iy + 5, { width: COL_VAL - 6, align: 'center' })
      iy += ALTURA_LINHA
    })

    doc.rect(MARGEM, iy, LARGURA_PAGINA, ALTURA_LINHA + 2).fill(COR_CINZA)
    doc.rect(MARGEM, iy, LARGURA_PAGINA, ALTURA_LINHA + 2).stroke(COR_BORDA).lineWidth(0.4)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COR_ESCURO)
    doc.text('VALOR TOTAL', MARGEM + 6, iy + 5, { width: COL_DESC - 10 })
    doc.text(formatarMoeda(total), MARGEM + COL_DESC, iy + 5, {
      width: COL_VAL - 6,
      align: 'center',
    })
    doc.y = iy + ALTURA_LINHA + 6

    // ── CONDIÇÕES DE PAGAMENTO ────────────────────────────────────────────
    secaoTitulo(doc, 'CONDIÇÕES DE PAGAMENTO')
    const condicoes = String(proposta.condicoes_pagamento || '')
    corpo(doc, condicoes)
    doc.moveDown(0.2)
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COR_ESCURO)
      .text(EMPRESA.banco, MARGEM, doc.y, { width: LARGURA_PAGINA })
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#111')
      .text(`Pix (CNPJ): ${EMPRESA.pix}`, MARGEM, doc.y, { width: LARGURA_PAGINA })
    doc.moveDown(0.4)

    // ── ASSINATURAS ───────────────────────────────────────────────────────
    if (doc.y > 620) doc.addPage()
    doc.moveDown(1.5)

    const nomeAprovador = String(proposta.nome_aprovador ?? '')
    const nomeContratado = String(proposta.nome_contratado ?? '')
    const metade = (LARGURA_PAGINA - 20) / 2
    const ASSIN_H = 70
    const assinY = doc.y

    function renderLado(buf: Buffer | null, xInicio: number) {
      if (buf) {
        try {
          doc.rect(xInicio, assinY, metade, ASSIN_H).strokeColor(COR_BORDA).lineWidth(0.5).stroke()
          doc.image(buf, xInicio + 4, assinY + 4, {
            fit: [metade - 8, ASSIN_H - 8],
            align: 'center',
            valign: 'center',
          })
        } catch { /* ignore */ }
      } else {
        doc
          .moveTo(xInicio, assinY + ASSIN_H)
          .lineTo(xInicio + metade, assinY + ASSIN_H)
          .strokeColor('#999').lineWidth(0.5).stroke()
      }
    }

    renderLado(assinBuf, MARGEM)
    renderLado(assinContratadoBuf, MARGEM + metade + 20)

    // Labels
    const labelY = assinY + ASSIN_H + 5
    doc.font('Helvetica').fontSize(8.5).fillColor('#333')
    doc.text(nomeAprovador || 'Assinatura do Contratante', MARGEM, labelY, { width: metade, align: 'center' })
    doc.text(nomeContratado || 'Assinatura do Contratado', MARGEM + metade + 20, labelY, { width: metade, align: 'center' })

    // Data
    const cidadeY = labelY + 20
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#333')
      .text(`Osasco, ${dataBr(proposta.data as string | Date)}`, MARGEM, cidadeY, { align: 'center', width: LARGURA_PAGINA })

    // ── AUTENTICIDADE ─────────────────────────────────────────────────────
    const guid = crypto.randomUUID()
    const agora = new Date()
    const dataHora = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const autenticY = cidadeY + 20
    doc
      .moveTo(MARGEM, autenticY)
      .lineTo(MARGEM + LARGURA_PAGINA, autenticY)
      .strokeColor('#e0e0e0').lineWidth(0.5).stroke()
    doc.font('Helvetica').fontSize(7).fillColor('#aaa')
      .text(`ID do documento: ${guid}`, MARGEM, autenticY + 5, { width: LARGURA_PAGINA, align: 'center' })
    doc.font('Helvetica').fontSize(7).fillColor('#aaa')
      .text(`Assinado digitalmente em: ${dataHora}`, MARGEM, autenticY + 15, { width: LARGURA_PAGINA, align: 'center' })
    doc.y = autenticY + 28

    doc.end()
  })
}
