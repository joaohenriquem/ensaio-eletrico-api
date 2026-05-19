import PDFDocument from 'pdfkit'
import {
  EMPRESA,
  ITENS_INSPECAO_VISUAL,
  ITENS_LIMPEZA,
  ITENS_REAPERTO,
  ITENS_VERIFICACAO_ELETRICA,
} from '../constants.js'
import { dataBr } from '../helpers.js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const COR_AZUL    = '#1a4b9c'
const COR_ESCURO  = '#1c1c2e'
const COR_VERMELHO = '#cc0000'
const COR_CINZA   = '#f5f5f5'
const COR_ROSA    = '#ffe0e0'
const COR_BRANCO  = '#ffffff'
const COR_BORDA   = '#cccccc'

const MARGEM = 40
const LARGURA_PAGINA = 595 - MARGEM * 2

interface PainelData {
  nome: string
  tipo?: string
  inspecao_visual?: Record<string, string>
  limpeza_tecnica?: Record<string, string>
  reaperto_mecanico?: Record<string, string>
  verificacao_eletrica?: Record<string, string>
  nao_conformidades?: string
  recomendacoes?: string
  fotos_inspecao_visual?: string[]
  fotos_limpeza_tecnica?: string[]
  fotos_reaperto_mecanico?: string[]
}

// ── Logo ────────────────────────────────────────────────────────────────────
function logoBuffer(): Buffer | null {
  try { return readFileSync(resolve(__dirname, '../static/logo.jpeg')) }
  catch { return null }
}

// ── Resolver imagem (base64 ou URL) para Buffer ──────────────────────────────
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

// ── Cabeçalho de página ──────────────────────────────────────────────────────
function cabecalhoPagina(
  doc: PDFKit.PDFDocument,
  data: string,
  local: string,
) {
  const logo = logoBuffer()
  const yTopo = doc.page.margins.top - 72
  const LOGO_W = 58

  if (logo) {
    try { doc.image(logo, MARGEM, yTopo, { width: LOGO_W, height: LOGO_W }) }
    catch { /* ignora */ }
  }

  const tx = MARGEM + (logo ? LOGO_W + 10 : 0)

  doc.save()
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COR_AZUL)
    .text('ENSAIO ELÉTRICO', tx, yTopo + 2)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COR_ESCURO)
    .text('RELATÓRIO DE MANUTENÇÃO PREVENTIVA', tx, yTopo + 20)
  doc.font('Helvetica').fontSize(7.5).fillColor('#444')
    .text(`DATA: ${data}`, tx, yTopo + 32)
    .text(`LOCAL: ${String(local).toUpperCase()}`, tx, yTopo + 42)
    .text(`CONTATO: ${EMPRESA.tel}  –  SITE: ${EMPRESA.site.toUpperCase()}`, tx, yTopo + 52)
  doc.restore()

  // linha separadora
  doc.moveTo(MARGEM, doc.page.margins.top - 8)
    .lineTo(MARGEM + LARGURA_PAGINA, doc.page.margins.top - 8)
    .strokeColor(COR_BORDA).lineWidth(0.5).stroke()

  doc.moveDown(1.5)
}

// ── Helpers de texto ─────────────────────────────────────────────────────────
function secaoTitulo(doc: PDFKit.PDFDocument, texto: string) {
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COR_AZUL).text(texto)
  doc.moveDown(0.2)
}

function subtitulo(doc: PDFKit.PDFDocument, texto: string) {
  doc.moveDown(0.35)
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COR_AZUL).text(texto)
  doc.moveDown(0.15)
}

function corpo(doc: PDFKit.PDFDocument, texto: string) {
  doc.font('Helvetica').fontSize(9).fillColor('#111').text(texto, { lineGap: 2 })
  doc.moveDown(0.25)
}

function linhaHorizontal(doc: PDFKit.PDFDocument) {
  doc.moveDown(0.3)
  doc.moveTo(MARGEM, doc.y).lineTo(MARGEM + LARGURA_PAGINA, doc.y)
    .strokeColor(COR_BORDA).lineWidth(0.5).stroke()
  doc.moveDown(0.3)
}

// ── Tabela checklist ─────────────────────────────────────────────────────────
function tabelaChecklist(
  doc: PDFKit.PDFDocument,
  titulo: string,
  itens: Record<string, string>,
  rotulos: Record<string, string>,
  x: number,
  largura: number,
) {
  const COL_ITEM = largura * 0.58
  const COL_C    = largura * 0.21
  const COL_NC   = largura * 0.21
  const ALTURA_L = 15
  const ALTURA_H = 17

  let y = doc.y

  // header linha 1: título da tabela
  doc.rect(x, y, largura, ALTURA_H).fill(COR_ESCURO)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COR_BRANCO)
  doc.text(titulo.toUpperCase(), x + 4, y + 5, { width: COL_ITEM - 4 })
  doc.text('CONFORME', x + COL_ITEM + 2, y + 5, { width: COL_C - 4, align: 'center' })

  // "NÃO CONFORME" com fundo vermelho
  doc.rect(x + COL_ITEM + COL_C, y, COL_NC, ALTURA_H).fill(COR_VERMELHO)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COR_BRANCO)
  doc.text('NÃO CONFORME', x + COL_ITEM + COL_C + 2, y + 5, { width: COL_NC - 4, align: 'center' })
  y += ALTURA_H

  Object.entries(rotulos).forEach(([chave, rotulo], i) => {
    const valor = itens?.[chave] ?? 'conforme'
    const nc = valor === 'nao_conforme'
    const bg = nc ? COR_ROSA : i % 2 === 0 ? COR_BRANCO : COR_CINZA

    doc.rect(x, y, largura, ALTURA_L).fill(bg)
    doc.rect(x, y, largura, ALTURA_L).stroke(COR_BORDA).lineWidth(0.3)

    doc.font('Helvetica').fontSize(7.5).fillColor('#111')
    doc.text(rotulo, x + 4, y + 4, { width: COL_ITEM - 6 })

    doc.font('Helvetica-Bold').fontSize(8)
    if (!nc) {
      doc.fillColor(COR_ESCURO)
      doc.text('X', x + COL_ITEM + 2, y + 4, { width: COL_C - 4, align: 'center' })
    } else {
      doc.fillColor(COR_VERMELHO)
      doc.text('X', x + COL_ITEM + COL_C + 2, y + 4, { width: COL_NC - 4, align: 'center' })
    }
    y += ALTURA_L
  })

  doc.y = y + 3
}

// ── Tabela Verificação Elétrica ──────────────────────────────────────────────
function tabelaVerificacaoEletrica(
  doc: PDFKit.PDFDocument,
  itens: Record<string, string>,
  x: number,
  largura: number,
) {
  const COL_ITEM  = largura * 0.52
  const COL_VALOR = largura * 0.27
  const COL_NC    = largura * 0.21
  const ALTURA_L  = 15
  const ALTURA_H  = 17

  let y = doc.y

  doc.rect(x, y, largura, ALTURA_H).fill(COR_ESCURO)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COR_BRANCO)
  doc.text('VERIFICAÇÃO ELÉTRICA', x + 4, y + 5, { width: COL_ITEM - 4 })
  doc.text('CONFORME/VALOR', x + COL_ITEM + 2, y + 5, { width: COL_VALOR - 4, align: 'center' })
  doc.rect(x + COL_ITEM + COL_VALOR, y, COL_NC, ALTURA_H).fill(COR_VERMELHO)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COR_BRANCO)
  doc.text('NÃO CONFORME', x + COL_ITEM + COL_VALOR + 2, y + 5, { width: COL_NC - 4, align: 'center' })
  y += ALTURA_H

  Object.entries(ITENS_VERIFICACAO_ELETRICA).forEach(([chave, rotulo], i) => {
    const valor = itens?.[chave] ?? ''
    const nc = valor === 'nao_conforme'
    const isMedicao = chave === 'medicao_tensao' || chave === 'medicao_corrente'
    const bg = nc ? COR_ROSA : i % 2 === 0 ? COR_BRANCO : COR_CINZA

    doc.rect(x, y, largura, ALTURA_L).fill(bg)
    doc.rect(x, y, largura, ALTURA_L).stroke(COR_BORDA).lineWidth(0.3)

    doc.font('Helvetica').fontSize(7.5).fillColor('#111')
    doc.text(rotulo, x + 4, y + 4, { width: COL_ITEM - 6 })

    doc.font('Helvetica-Bold').fontSize(7.5)
    if (isMedicao) {
      doc.fillColor(COR_ESCURO)
      doc.text(valor || '–', x + COL_ITEM + 2, y + 4, { width: COL_VALOR - 4, align: 'center' })
    } else if (!nc) {
      doc.fillColor(COR_ESCURO)
      doc.text('X', x + COL_ITEM + 2, y + 4, { width: COL_VALOR - 4, align: 'center' })
    } else {
      doc.fillColor(COR_VERMELHO)
      doc.text('X', x + COL_ITEM + COL_VALOR + 2, y + 4, { width: COL_NC - 4, align: 'center' })
    }
    y += ALTURA_L
  })

  doc.y = y + 3
}

// ── Foto ao lado de tabela ────────────────────────────────────────────────────
function fotoAoLadoDeTabela(
  doc: PDFKit.PDFDocument,
  fotoBuf: Buffer | null,
  titulo: string,
  itens: Record<string, string>,
  rotulos: Record<string, string>,
) {
  const FOTO_W = 210
  const GAP = 8
  const TABLE_X = MARGEM + (fotoBuf ? FOTO_W + GAP : 0)
  const TABLE_W = fotoBuf ? LARGURA_PAGINA - FOTO_W - GAP : LARGURA_PAGINA

  const yIni = doc.y
  const FOTO_H = 130

  if (fotoBuf) {
    try {
      doc.rect(MARGEM, yIni, FOTO_W, FOTO_H).stroke(COR_BORDA)
      doc.image(fotoBuf, MARGEM + 2, yIni + 2, { fit: [FOTO_W - 4, FOTO_H - 4], align: 'center', valign: 'center' })
    } catch { /* ignora */ }
  }

  doc.y = yIni
  tabelaChecklist(doc, titulo, itens, rotulos, TABLE_X, TABLE_W)

  if (fotoBuf) doc.y = Math.max(yIni + FOTO_H + 4, doc.y)
}

// ── Fotos em linha ────────────────────────────────────────────────────────────
function fotosEmLinha(doc: PDFKit.PDFDocument, fotosBuf: (Buffer | null)[]) {
  const validas = fotosBuf.filter((b): b is Buffer => b !== null).slice(0, 4)
  if (!validas.length) return

  const n = validas.length
  const GAP = 6
  const W = (LARGURA_PAGINA - GAP * (n - 1)) / n
  const H = 130

  if (doc.y + H + 10 > doc.page.height - doc.page.margins.bottom) doc.addPage()

  const yF = doc.y
  validas.forEach((buf, i) => {
    try {
      const xF = MARGEM + i * (W + GAP)
      doc.rect(xF, yF, W, H).stroke(COR_BORDA)
      doc.image(buf, xF + 2, yF + 2, { fit: [W - 4, H - 4], align: 'center', valign: 'center' })
    } catch { /* ignora */ }
  })
  doc.y = yF + H + 6
}

// ── GERADOR PRINCIPAL ─────────────────────────────────────────────────────────
export async function gerarPdfRelatorio(relatorio: Record<string, unknown>): Promise<Buffer> {
  const paineisPre: PainelData[] = Array.isArray(relatorio.paineis)
    ? (relatorio.paineis as PainelData[]) : []

  // Coleta todos os srcs únicos para pré-busca
  const allSrcs = new Set<string>()
  paineisPre.forEach(p => {
    ;[...(p.fotos_inspecao_visual ?? []),
      ...(p.fotos_limpeza_tecnica ?? []),
      ...(p.fotos_reaperto_mecanico ?? [])].forEach(s => s && allSrcs.add(s))
  })
  const assinSrc = String(relatorio.assinatura ?? '')
  const assinContratadoSrc = String(relatorio.assinatura_contratado ?? '')
  if (assinSrc) allSrcs.add(assinSrc)
  if (assinContratadoSrc) allSrcs.add(assinContratadoSrc)

  const imgCache = new Map<string, Buffer | null>()
  await Promise.all([...allSrcs].map(async s => { imgCache.set(s, await resolverImagem(s)) }))

  function getBuf(src: string | undefined): Buffer | null {
    if (!src) return null
    return imgCache.get(src) ?? null
  }

  return new Promise((resolve2, reject) => {
    const chunks: Buffer[] = []
    const dataStr = dataBr(relatorio.data as string | Date ?? '')

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 90, bottom: 40, left: MARGEM, right: MARGEM },
      info: { Title: `Relatório ${relatorio.numero}`, Author: EMPRESA.nome, Subject: String(relatorio.data ?? '') },
    })

    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve2(Buffer.concat(chunks)))
    doc.on('error', reject)

    const local = String(relatorio.local ?? '')

    doc.on('pageAdded', () => cabecalhoPagina(doc, dataStr, local))

    const paineis: PainelData[] = paineisPre
    const normas: string[] = Array.isArray(relatorio.normas)
      ? (relatorio.normas as string[]) : []

    // dispara cabeçalho da primeira página manualmente
    cabecalhoPagina(doc, dataStr, local)

    // ── SUMÁRIO ──────────────────────────────────────────────────────────────
    secaoTitulo(doc, '1. SUMÁRIO:')
    const secoes = [
      '2. OBJETIVO',
      '3. REFERÊNCIAS NORMATIVAS',
      '4. MANUTENÇÃO PREVENTIVA',
      ...paineis.map((p, i) => `${i + 5}. ${(p.nome || 'PAINEL').toUpperCase()}`),
    ]
    const nFim = paineis.length + 5
    secoes.push(
      `${nFim}. TOMADAS`,
      `${nFim + 1}. ILUMINAÇÃO`,
      `${nFim + 2}. CONCLUSÃO`,
      `${nFim + 3}. RESPONSABILIDADE TÉCNICA`,
      `${nFim + 4}. APROVAÇÃO DO SERVIÇO`,
    )
    secoes.forEach(s => {
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COR_AZUL).text(s, { indent: 10, lineGap: 1 })
    })

    // ── OBJETIVO ─────────────────────────────────────────────────────────────
    doc.moveDown(0.8)
    secaoTitulo(doc, '2. OBJETIVO')
    corpo(doc, String(relatorio.objetivo ?? '').toUpperCase())

    // ── REFERÊNCIAS NORMATIVAS ───────────────────────────────────────────────
    secaoTitulo(doc, '3. REFERÊNCIAS NORMATIVAS')
    normas.forEach(n => {
      doc.font('Helvetica').fontSize(9).fillColor('#111')
        .text(`${n.toUpperCase()}.`, { indent: 8, lineGap: 3 })
    })

    // ── MANUTENÇÃO PREVENTIVA ────────────────────────────────────────────────
    doc.moveDown(0.5)
    secaoTitulo(doc, '4. MANUTENÇÃO PREVENTIVA')
    corpo(doc,
      `SERÁ EXECUTADO MANUTENÇÃO PREVENTIVA EM ${paineis.length} PAINEL(IS) ELÉTRICO(S), TROCA DE LÂMPADAS QUEIMADAS, SENSORES E TOMADAS QUE ESTIVEREM COM DEFEITO.`
    )

    // ── PAINÉIS ──────────────────────────────────────────────────────────────
    paineis.forEach((painel, idx) => {
      const secNum = idx + 5
      doc.addPage()

      secaoTitulo(doc, `${secNum}. ${(painel.nome || 'PAINEL').toUpperCase()}`)
      if (painel.tipo) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#555')
          .text(`Tipo: ${painel.tipo}`)
        doc.moveDown(0.2)
      }

      // ── Inspeção Visual ────────────────────────────────────────────────────
      const fotosInspBuf = (painel.fotos_inspecao_visual ?? []).map(s => getBuf(s))
      if (fotosInspBuf.some(Boolean)) {
        fotosEmLinha(doc, fotosInspBuf)
        doc.moveDown(0.3)
      }

      tabelaChecklist(doc, 'INSPEÇÃO VISUAL', painel.inspecao_visual ?? {}, ITENS_INSPECAO_VISUAL, MARGEM, LARGURA_PAGINA)

      // ── Limpeza + Reaperto ─────────────────────────────────────────────────
      if (doc.y > 620) doc.addPage()

      const fotoLimpSrc = (painel.fotos_limpeza_tecnica ?? []).filter(Boolean)[0]
      const fotoReapSrc = (painel.fotos_reaperto_mecanico ?? []).filter(Boolean)[0]

      doc.moveDown(0.3)
      fotoAoLadoDeTabela(doc, getBuf(fotoLimpSrc), 'LIMPEZA TÉCNICA', painel.limpeza_tecnica ?? {}, ITENS_LIMPEZA)

      doc.moveDown(0.3)
      fotoAoLadoDeTabela(doc, getBuf(fotoReapSrc), 'REAPERTO MECÂNICO', painel.reaperto_mecanico ?? {}, ITENS_REAPERTO)

      // ── Verificação Elétrica ───────────────────────────────────────────────
      if (doc.y > 640) doc.addPage()
      doc.moveDown(0.3)
      tabelaVerificacaoEletrica(doc, painel.verificacao_eletrica ?? {}, MARGEM, LARGURA_PAGINA)

      // ── Não Conformidades ──────────────────────────────────────────────────
      if (painel.nao_conformidades) {
        doc.moveDown(0.4)
        subtitulo(doc, `${secNum}.1. NÃO CONFORMIDADES`)
        doc.font('Helvetica').fontSize(9).fillColor(COR_VERMELHO)
          .text(painel.nao_conformidades.toUpperCase(), { lineGap: 2 })
      }

      // ── Recomendações ──────────────────────────────────────────────────────
      if (painel.recomendacoes) {
        doc.moveDown(0.4)
        subtitulo(doc, `${secNum}.2. RECOMENDAÇÕES`)
        corpo(doc, painel.recomendacoes.toUpperCase())
      }
    })

    // ── SEÇÕES FINAIS ─────────────────────────────────────────────────────────
    if (doc.y > 600) doc.addPage()
    linhaHorizontal(doc)

    secaoTitulo(doc, `${nFim}. TOMADAS`)
    corpo(doc, String(relatorio.tomadas || 'NÃO HOUVE TOMADAS PARA TROCA.').toUpperCase())

    secaoTitulo(doc, `${nFim + 1}. ILUMINAÇÃO`)
    corpo(doc, String(relatorio.iluminacao || '–').toUpperCase())

    secaoTitulo(doc, `${nFim + 2}. CONCLUSÃO`)
    corpo(doc, String(relatorio.conclusao || '').toUpperCase())

    // ── RESPONSABILIDADE TÉCNICA ──────────────────────────────────────────────
    if (doc.y > 640) doc.addPage()
    secaoTitulo(doc, `${nFim + 3}. RESPONSABILIDADE TÉCNICA`)

    const tecnico = String(relatorio.tecnico ?? '')
    const cft = String(relatorio.cft ?? '')
    const trt = String(relatorio.trt ?? '')

    doc.moveDown(1.5)
    doc.moveTo(MARGEM, doc.y)
      .lineTo(MARGEM + 220, doc.y)
      .strokeColor('#333').lineWidth(0.5).stroke()
    doc.moveDown(0.3)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COR_ESCURO).text(tecnico.toUpperCase(), MARGEM)
    doc.font('Helvetica').fontSize(9).fillColor('#333')
      .text(`Técnico em Eletrotécnica: ${tecnico}`)
      .text(`CFT: ${cft}`)

    if (trt) {
      doc.moveDown(0.8)
      doc.moveTo(MARGEM, doc.y)
        .lineTo(MARGEM + 220, doc.y)
        .strokeColor('#333').lineWidth(0.5).stroke()
      doc.moveDown(0.3)
      doc.font('Helvetica').fontSize(9).fillColor('#333').text(`TRT: ${trt}`)
    }

    // ── ASSINATURAS ───────────────────────────────────────────────────────────
    const nomeAprovador = String(relatorio.nome_aprovador ?? '')
    const nomeContratado = String(relatorio.nome_contratado ?? '')
    const assinBuf = getBuf(assinSrc)
    const assinContratadoBuf = getBuf(assinContratadoSrc)

    if (doc.y > 620) doc.addPage()
    linhaHorizontal(doc)
    secaoTitulo(doc, `${nFim + 4}. APROVAÇÃO DO SERVIÇO`)

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
          .strokeColor(COR_BORDA).lineWidth(0.5).stroke()
      }
    }

    renderLado(assinBuf, MARGEM)
    renderLado(assinContratadoBuf, MARGEM + metade + 20)

    const labelY = assinY + ASSIN_H + 5
    doc.font('Helvetica').fontSize(8.5).fillColor('#333')
      .text(nomeAprovador || 'Assinatura do Aprovador', MARGEM, labelY, { width: metade, align: 'center' })
    doc.font('Helvetica').fontSize(7.5).fillColor('#888')
      .text('Aprovador do Serviço', MARGEM, labelY + 12, { width: metade, align: 'center' })

    doc.font('Helvetica').fontSize(8.5).fillColor('#333')
      .text(nomeContratado || 'Assinatura do Técnico', MARGEM + metade + 20, labelY, { width: metade, align: 'center' })
    doc.font('Helvetica').fontSize(7.5).fillColor('#888')
      .text('Técnico Responsável', MARGEM + metade + 20, labelY + 12, { width: metade, align: 'center' })

    // ── AUTENTICIDADE ─────────────────────────────────────────────────────
    const guid = crypto.randomUUID()
    const agora = new Date()
    const dataHora = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const autenticY = labelY + 30
    doc
      .moveTo(MARGEM, autenticY)
      .lineTo(MARGEM + LARGURA_PAGINA, autenticY)
      .strokeColor('#e0e0e0').lineWidth(0.5).stroke()
    doc.font('Helvetica').fontSize(7).fillColor('#aaa')
      .text(`ID do documento: ${guid}`, MARGEM, autenticY + 5, { width: LARGURA_PAGINA, align: 'center' })
    doc.font('Helvetica').fontSize(7).fillColor('#aaa')
      .text(`Assinado digitalmente em: ${dataHora}`, MARGEM, autenticY + 15, { width: LARGURA_PAGINA, align: 'center' })

    doc.end()
  })
}
