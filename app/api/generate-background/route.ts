import { NextRequest, NextResponse } from 'next/server';

const LEONARDO_API = 'https://cloud.leonardo.ai/api/rest/v1';

const PRESET_PROMPTS: Record<string, string> = {
  'Classic Elegant': 'traditional Hebrew wedding invitation background, ornate gold filigree borders, cream and ivory tones, classical calligraphy flourishes, timeless elegance, soft candlelight glow',
  'Modern Minimalist': 'modern minimalist invitation background, clean geometric lines, white and soft grey tones, sophisticated negative space, contemporary luxury, subtle texture',
  'Floral & Romantic': 'romantic floral invitation background, soft pink and blush roses, garden florals, pastel watercolor blooms, delicate greenery, dreamy soft light',
  'Jerusalem Stone': 'Jerusalem stone texture invitation background, warm sandstone, ancient heritage architecture, earthy ivory and terra cotta tones, Middle Eastern cultural motifs, warm golden hour light',
  'Luxury Gold & Ivory': 'luxury gold and ivory invitation background, opulent gold foil details, ivory silk fabric texture, premium high-end stationery aesthetic, rich metallic sheen, elegant and lavish',
};

function buildPrompt(preset: string): string {
  const base = PRESET_PROMPTS[preset] ?? PRESET_PROMPTS['Classic Elegant'];
  return `${base}, vertical portrait format, ultra detailed, cinematic lighting, no text, no words, no letters, no numbers, no watermark`;
}

async function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { preset } = await req.json();

    const apiKey = process.env.LEONARDO_API_KEY;
    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json(
        { error: 'Add your Leonardo AI key to .env.local → LEONARDO_API_KEY=... then restart the server.' },
        { status: 401 }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // Step 1: Start generation
    const genRes = await fetch(`${LEONARDO_API}/generations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        modelId: 'b2614463-296c-462a-9586-aafdb8f00e36', // Flux Dev (matches element base model)
        prompt: buildPrompt(preset),
        width: 768,
        height: 1344,
        num_images: 1,
        contrast: 3.5,
        guidance_scale: 7,
        userElements: [{ userLoraId: 186250, weight: 1.0 }],
      }),
    });

    if (!genRes.ok) {
      const body = await genRes.text();
      if (genRes.status === 401 || genRes.status === 403) {
        return NextResponse.json(
          { error: 'Leonardo AI rejected the key. Check that it is correct.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Leonardo error (${genRes.status}): ${body.slice(0, 150)}` },
        { status: 502 }
      );
    }

    const genJson = await genRes.json();
    const generationId: string = genJson.sdGenerationJob?.generationId;
    if (!generationId) {
      return NextResponse.json({ error: 'No generation ID returned from Leonardo.' }, { status: 502 });
    }

    // Step 2: Poll until complete (max ~60 s)
    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(2000);
      const pollRes = await fetch(`${LEONARDO_API}/generations/${generationId}`, { headers });
      if (!pollRes.ok) continue;

      const pollJson = await pollRes.json();
      const job = pollJson.generations_by_pk;
      if (!job) continue;

      if (job.status === 'COMPLETE') {
        const imageUrl: string = job.generated_images?.[0]?.url;
        if (!imageUrl) {
          return NextResponse.json({ error: 'Generation complete but no image returned.' }, { status: 502 });
        }
        // Fetch the image server-side and return as base64 to avoid CORS issues in html2canvas
        const imgRes = await fetch(imageUrl);
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg';
        return NextResponse.json({ url: `data:${mimeType};base64,${base64}` });
      }

      if (job.status === 'FAILED') {
        return NextResponse.json({ error: 'Leonardo generation failed.' }, { status: 502 });
      }
    }

    return NextResponse.json({ error: 'Generation timed out after 60 s — try again.' }, { status: 504 });

  } catch (err) {
    console.error('[generate-background]', err);
    return NextResponse.json({ error: `Server error: ${String(err)}` }, { status: 500 });
  }
}
