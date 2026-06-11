// GET /api/watermarks — returns all saved watermark configs as { [templateId]: WatermarkConfig }
//
// One-time Supabase setup — run this SQL in your Supabase dashboard:
//   CREATE TABLE IF NOT EXISTS template_watermarks (
//     template_id TEXT PRIMARY KEY,
//     x           FLOAT8 NOT NULL,
//     y           FLOAT8 NOT NULL,
//     w           FLOAT8 NOT NULL,
//     color       TEXT   NOT NULL DEFAULT '#bfa67c',
//     opacity     FLOAT8 NOT NULL DEFAULT 1
//   );

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import type { WatermarkConfig } from '@/lib/templates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('template_watermarks')
      .select('template_id, x, y, w, color, opacity');

    if (error) {
      // Table doesn't exist yet — return empty object gracefully
      console.warn('[watermarks] Supabase error (table may not exist yet):', error.message);
      return NextResponse.json({});
    }

    const map: Record<string, WatermarkConfig> = {};
    for (const row of data ?? []) {
      map[row.template_id] = { x: row.x, y: row.y, w: row.w, color: row.color, opacity: row.opacity };
    }
    return NextResponse.json(map);
  } catch (err) {
    console.error('[watermarks]', err);
    return NextResponse.json({});
  }
}
