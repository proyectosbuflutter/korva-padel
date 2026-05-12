// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_KEY') || '';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record || body;
    const tabla = body.table || 'productos';

    if (!record?.nombre || !record?.id || record?.nombre_en) {
      return new Response(JSON.stringify({ skip: true }), { status: 200 });
    }

    const prompt = `You are a professional ecommerce localization specialist.
Task:
Translate the following product content from Spanish to English.
Context:
This is a premium padel sports brand (high-performance, technical, minimalist positioning). The translation must sound natural, premium, and commercial, but must remain faithful to the original meaning.
Rules:
- Do NOT add new information
- Do NOT exaggerate or invent features
- Do NOT use poetic or overly creative language
- Keep a premium, modern, athletic tone (similar to high-end sports brands)
- Adapt phrasing so it sounds natural in English ecommerce (not literal translation)
- Keep technical terms accurate and consistent
- Keep sentences concise and product-focused
- Avoid slang or informal expressions
Style reference:
Nike / Adidas / Wilson / Babolat (premium product descriptions, not marketing slogans)
Input:
Title:
${record.nombre}
Description:
${record.descripcion || ''}
Output format:
Return ONLY JSON:
{
  "title_en": "...",
  "description_en": "..."
}
If a sentence in Spanish is unclear, prefer a safe literal translation rather than guessing.`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    const openaiData = await openaiRes.json();
    const content = openaiData.choices[0].message.content;
    const match = content.match(/\{[\s\S]*\}/);
    if(!match) throw new Error('No JSON found in OpenAI response: ' + content);
    const clean = match[0];
    const translated = JSON.parse(clean);

    await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${record.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        nombre_en: translated.title_en,
        descripcion_en: translated.description_en
      })
    });

    return new Response(JSON.stringify({ ok: true, translated }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});