import { Hono } from 'hono'
import { authMiddleware } from '../auth.js'
import { createClient } from '@supabase/supabase-js'

const uploads = new Hono()

uploads.use('/*', authMiddleware)

uploads.post('/', async (c) => {
  try {
    const form = await c.req.formData()
    const file = form.get('file') as File | null

    if (!file || typeof file === 'string') {
      return c.json({ error: 'Nenhum arquivo enviado' }, 400)
    }

    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const nome = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const mime = file.type || 'image/jpeg'

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage
      .from('relatorios')
      .upload(nome, buffer, { contentType: mime, upsert: false })

    if (error) {
      console.error('[upload] supabase error:', error)
      return c.json({ error: 'Falha no upload', detalhe: error.message }, 500)
    }

    const { data } = supabase.storage.from('relatorios').getPublicUrl(nome)
    return c.json({ url: data.publicUrl })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload] erro interno:', msg)
    return c.json({ error: 'Erro interno no servidor', detalhe: msg }, 500)
  }
})

export default uploads
