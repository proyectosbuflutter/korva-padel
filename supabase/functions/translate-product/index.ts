import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiKey = Deno.env.get('OPENAI_API_KEY')!

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    // PRODUCTOS pendientes
    const { data: productos } = await supabase
      .from('productos')
      .select('*')
      .eq('needs_translation', true)

    for (const p of productos || []) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 500,
          messages: [{ role: 'user', content: `Translate to English. Return ONLY JSON with keys nombre_en and descripcion_en. No explanation.\nnombre: ${p.nombre}\ndescripcion: ${p.descripcion || ''}` }]
        })
      })
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) continue
      const translated = JSON.parse(match[0])
      await supabase.from('productos').update({
        nombre_en: translated.nombre_en || '',
        descripcion_en: translated.descripcion_en || '',
        needs_translation: false
      }).eq('id', p.id)
    }

    // PACKS pendientes
    const { data: packs } = await supabase
      .from('packs')
      .select('*')
      .eq('needs_translation', true)

    for (const p of packs || []) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 200,
          messages: [{ role: 'user', content: `Translate to English. Return ONLY JSON with keys nombre_en and badge_en. No explanation.\nnombre: ${p.nombre}\nbadge: ${p.badge || ''}` }]
        })
      })
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) continue
      const translated = JSON.parse(match[0])
      await supabase.from('packs').update({
        nombre_en: translated.nombre_en || '',
        badge_en: translated.badge_en || '',
        needs_translation: false
      }).eq('id', p.id)
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    return new Response('error: ' + e.message, { status: 200 })
  }
})