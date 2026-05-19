import nodemailer from 'nodemailer'
import { createHmac } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function logoSrc(): string {
  try {
    const data = readFileSync(resolve(__dirname, 'static/logo_ensaio_eletrico.png'))
    return `data:image/png;base64,${data.toString('base64')}`
  } catch {
    return ''
  }
}

export function gerarTokenAcao(id: string, acao: string): string {
  const secret = process.env.JWT_SECRET ?? 'dev-secret'
  return createHmac('sha256', secret).update(`${id}:${acao}`).digest('hex').slice(0, 32)
}

async function enviar(destinatario: string, subject: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY não configurada')

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Ensaio Elétrico', email: process.env.BREVO_SENDER ?? 'ensaioeletrico.servicos@gmail.com' },
      to: [{ email: destinatario }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(String(err.message ?? `Erro HTTP ${res.status}`))
  }
}

export async function enviarEmailAprovacao(os: Record<string, unknown>, destinatario: string) {
  const id = String(os._id)
  const tokenAprovar = gerarTokenAcao(id, 'aprovar')
  const tokenReprovar = gerarTokenAcao(id, 'reprovar')
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3001'
  const urlAprovar = `${baseUrl}/api/ordens/${id}/resposta?acao=aprovar&token=${tokenAprovar}`
  const urlReprovar = `${baseUrl}/api/ordens/${id}/resposta?acao=reprovar&token=${tokenReprovar}`

  await enviar(destinatario, `[${os.numero}] Solicitação de Aprovação – Ordem de Serviço`, templateAprovacao(os, urlAprovar, urlReprovar))
}

export async function enviarEmailConclusao(os: Record<string, unknown>, destinatario: string) {
  await enviar(destinatario, `[${os.numero}] Serviço Concluído – Ensaio Elétrico`, templateConclusao(os))
}

export async function enviarEmailCadastroRecebido(usuario: Record<string, unknown>) {
  await enviar(String(usuario.email), 'Cadastro recebido – Ensaio Elétrico', templateCadastroRecebido(usuario))
}

export async function enviarEmailAdminNovoCadastro(usuario: Record<string, unknown>) {
  const adminEmail = process.env.BREVO_SENDER ?? 'ensaioeletrico.servicos@gmail.com'
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  await enviar(adminEmail, `Novo cadastro pendente: ${usuario.nome}`, templateAdminNovoCadastro(usuario, frontendUrl))
}

export async function enviarEmailUsuarioAprovado(usuario: Record<string, unknown>) {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  await enviar(String(usuario.email), 'Acesso aprovado – Ensaio Elétrico', templateUsuarioAprovado(usuario, frontendUrl))
}

export async function enviarEmailUsuarioRejeitado(usuario: Record<string, unknown>, motivo?: string) {
  await enviar(String(usuario.email), 'Cadastro não aprovado – Ensaio Elétrico', templateUsuarioRejeitado(usuario, motivo))
}

function base(conteudo: string): string {
  const logo = logoSrc()
  const header = logo
    ? `<img src="${logo}" alt="Ensaio Elétrico" style="height:72px;width:auto;" />`
    : `<h1 style="color:#f0a500;margin:0;font-size:22px;">ENSAIO ELÉTRICO</h1>`
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1c1c2e;padding:24px;text-align:center;">
        ${header}
      </div>
      <div style="padding:32px;background:#ffffff;border:1px solid #e5e7eb;">${conteudo}</div>
      <div style="background:#1c1c2e;padding:16px;text-align:center;">
        <p style="color:rgba(255,255,255,.3);font-size:11px;margin:0;">
          Ensaio Elétrico · CNPJ 61.841.485/0001-30 · Osasco – SP<br>
          (11) 92137-4849 · ensaioeletrico.servicos@gmail.com
        </p>
      </div>
    </div>`
}

function tabelaOS(os: Record<string, unknown>): string {
  const linhas = [
    ['Número', os.numero],
    ['Cliente', os.cliente_nome],
    ['Tipo de Serviço', os.tipo],
    ['Local', os.local || '–'],
    ['Data', os.data],
    ['Técnico', os.tecnico || '–'],
  ]
  const rows = linhas
    .map(([k, v], i) =>
      `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
        <td style="padding:8px 12px;font-weight:bold;color:#374151;width:40%;">${k}</td>
        <td style="padding:8px 12px;color:#111827;">${v}</td>
      </tr>`
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>`
}

function templateAprovacao(os: Record<string, unknown>, urlAprovar: string, urlReprovar: string): string {
  return base(`
    <h2 style="color:#1c1c2e;margin-top:0;">Solicitação de Aprovação de OS</h2>
    <p style="color:#374151;">Prezado(a) cliente, segue abaixo os detalhes da Ordem de Serviço para sua análise e aprovação:</p>
    ${tabelaOS(os)}
    <div style="background:#fffbeb;padding:12px 16px;border-left:4px solid #f0a500;margin:16px 0;">
      <p style="font-weight:bold;margin:0 0 4px;color:#374151;">Descrição do Serviço</p>
      <p style="margin:0;color:#111827;">${String(os.descricao ?? '').replace(/\n/g, '<br>')}</p>
    </div>
    <p style="color:#374151;font-weight:bold;margin:24px 0 12px;">Clique abaixo para responder:</p>
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <a href="${urlAprovar}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:15px;">✅ Aprovar</a>
      <a href="${urlReprovar}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:15px;">❌ Reprovar</a>
    </div>
    <p style="color:#6b7280;font-size:12px;">Dúvidas: 📞 (11) 92137-4849 / (11) 98521-9614</p>
  `)
}

function templateCadastroRecebido(usuario: Record<string, unknown>): string {
  return base(`
    <h2 style="color:#1c1c2e;margin-top:0;">Cadastro Recebido!</h2>
    <p style="color:#374151;">Olá, <strong>${usuario.nome}</strong>!</p>
    <p style="color:#374151;">Seu cadastro foi recebido com sucesso e está aguardando aprovação de um administrador.</p>
    <div style="background:#fffbeb;padding:12px 16px;border-left:4px solid #f0a500;margin:16px 0;">
      <p style="margin:0;color:#374151;">Você receberá um e-mail assim que seu acesso for liberado. Este processo geralmente leva menos de 24 horas.</p>
    </div>
    <p style="color:#6b7280;font-size:13px;">Dúvidas: 📞 (11) 92137-4849 / ensaioeletrico.servicos@gmail.com</p>
  `)
}

function templateAdminNovoCadastro(usuario: Record<string, unknown>, frontendUrl: string): string {
  return base(`
    <h2 style="color:#1c1c2e;margin-top:0;">Novo Cadastro Pendente</h2>
    <p style="color:#374151;">Um novo usuário solicitou acesso ao sistema:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f9fafb;">
        <td style="padding:8px 12px;font-weight:bold;color:#374151;width:40%;">Nome</td>
        <td style="padding:8px 12px;color:#111827;">${usuario.nome}</td>
      </tr>
      <tr style="background:#ffffff;">
        <td style="padding:8px 12px;font-weight:bold;color:#374151;">E-mail</td>
        <td style="padding:8px 12px;color:#111827;">${usuario.email}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:8px 12px;font-weight:bold;color:#374151;">Usuário</td>
        <td style="padding:8px 12px;color:#111827;">${usuario.username}</td>
      </tr>
      <tr style="background:#ffffff;">
        <td style="padding:8px 12px;font-weight:bold;color:#374151;">Perfil</td>
        <td style="padding:8px 12px;color:#111827;">${usuario.perfil}</td>
      </tr>
    </table>
    <a href="${frontendUrl}/usuarios" style="display:inline-block;background:#1c1c2e;color:#f0a500;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:15px;">Gerenciar Usuários</a>
  `)
}

function templateUsuarioAprovado(usuario: Record<string, unknown>, frontendUrl: string): string {
  return base(`
    <h2 style="color:#1c1c2e;margin-top:0;">✅ Acesso Aprovado!</h2>
    <p style="color:#374151;">Olá, <strong>${usuario.nome}</strong>!</p>
    <p style="color:#374151;">Seu cadastro foi <strong style="color:#16a34a;">aprovado</strong>. Você já pode acessar o sistema com seu usuário e senha.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${frontendUrl}/login" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:15px;">Acessar o Sistema</a>
    </div>
    <p style="color:#6b7280;font-size:13px;">Dúvidas: 📞 (11) 92137-4849 / ensaioeletrico.servicos@gmail.com</p>
  `)
}

function templateUsuarioRejeitado(usuario: Record<string, unknown>, motivo?: string): string {
  return base(`
    <h2 style="color:#1c1c2e;margin-top:0;">Cadastro Não Aprovado</h2>
    <p style="color:#374151;">Olá, <strong>${usuario.nome}</strong>!</p>
    <p style="color:#374151;">Infelizmente seu cadastro não foi aprovado neste momento.</p>
    ${motivo ? `<div style="background:#fef2f2;padding:12px 16px;border-left:4px solid #dc2626;margin:16px 0;"><p style="margin:0;color:#374151;"><strong>Motivo:</strong> ${motivo}</p></div>` : ''}
    <p style="color:#374151;">Em caso de dúvidas, entre em contato conosco.</p>
    <p style="color:#6b7280;font-size:13px;">📞 (11) 92137-4849 / ensaioeletrico.servicos@gmail.com</p>
  `)
}

function templateConclusao(os: Record<string, unknown>): string {
  return base(`
    <h2 style="color:#1c1c2e;margin-top:0;">✅ Serviço Concluído</h2>
    <p style="color:#374151;">Prezado(a) cliente, informamos que a Ordem de Serviço abaixo foi <strong style="color:#16a34a;">concluída com sucesso</strong>.</p>
    ${tabelaOS(os)}
    <div style="background:#dcfce7;padding:12px 16px;border-left:4px solid #16a34a;margin:16px 0;">
      <p style="margin:0;color:#15803d;font-weight:bold;">Agradecemos pela confiança! Estamos à disposição para novas demandas.</p>
    </div>
    <p style="color:#6b7280;font-size:13px;">📞 (11) 92137-4849 / (11) 98521-9614</p>
  `)
}
