import path from 'path'
import { fileURLToPath } from 'url'
import { dataBr } from '../helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOGO_PATH = path.resolve(__dirname, '../static/logo.jpeg')

const COR_ESCURO = '#1c1c2e'
const COR_AMARELO = '#f0a500'

const MARGEM = 40
const LARGURA_PAGINA = 595 - MARGEM * 2

export interface CapaOpts {
  /** Título do tipo de documento, ex: "PROPOSTA DE PROJETO ELÉTRICO" */
  titulo: string
  /** Linha abaixo do logo, ex: descrição do serviço */
  subtitulo?: string
  cliente: string
  local: string
  /** Data a exibir na capa, já formatada (ex: "17/08/2026"). Se omitida, usa a data de geração do PDF. */
  data?: string
}

/**
 * Desenha a capa padrão (página cheia) no documento atual.
 * A "Data" exibida é a data de geração do PDF, a menos que `opts.data` seja informado.
 */
export function desenharCapa(doc: PDFKit.PDFDocument, opts: CapaOpts) {
  let y = 90

  doc
    .font('Helvetica-Bold')
    .fontSize(19)
    .fillColor(COR_ESCURO)
    .text(opts.titulo.toUpperCase(), MARGEM, y, { width: LARGURA_PAGINA, align: 'center' })

  y += 100
  const LOGO_H = 210
  try {
    doc.image(LOGO_PATH, MARGEM + LARGURA_PAGINA / 2 - LOGO_H / 2, y, { height: LOGO_H })
  } catch { /* ignora logo ausente */ }
  y += LOGO_H + 26

  if (opts.subtitulo) {
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(COR_ESCURO)
      .text(opts.subtitulo.toUpperCase(), MARGEM, y, { width: LARGURA_PAGINA, align: 'center' })
    y += 34
  }

  y += 40
  const CAMPO_X = MARGEM + 60
  const CAMPO_W = LARGURA_PAGINA - 120

  const campos: [string, string][] = [
    ['Cliente:', opts.cliente],
    ['Local:', opts.local],
    ['Data:', opts.data ?? dataBr(new Date())],
  ]

  // Rótulo em cima e valor embaixo — evita sobreposição quando o valor
  // (nome do cliente, endereço) é longo e quebra em várias linhas.
  campos.forEach(([rotulo, valor]) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor(COR_ESCURO)
      .text(rotulo, CAMPO_X, y, { width: CAMPO_W })
    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor('#111')
      .text(valor, CAMPO_X, doc.y + 1, { width: CAMPO_W })

    y = doc.y + 16
  })

  doc
    .moveTo(MARGEM, y + 10)
    .lineTo(MARGEM + LARGURA_PAGINA, y + 10)
    .strokeColor(COR_AMARELO)
    .lineWidth(1.5)
    .stroke()
}
