import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

/** Server-side client that acts on behalf of an authenticated user.
 *  Pass the user's access token so Supabase RLS policies apply. */
export function createAuthenticatedClient(accessToken: string) {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export type InvitationSettings = {
  bg: string;
  overlayOpacity?: number;
  glowIntensity?: number;
  titleSize?: number; nameSize?: number; dateSize?: number;
  titleX?: number; titleY?: number;
  nameX?: number; nameY?: number;
  dateX?: number; dateY?: number;
  titleColor?: string; nameColor?: string; dateColor?: string;
  titleFont?: string; nameFont?: string; dateFont?: string;
  // Template-based design fields
  isTemplate?: boolean;
  templateId?: string;
  textSvg?: string;
  fieldValues?: Record<string, string>;
};

export type Invitation = {
  id: string;
  name: string;
  event_title: string;
  host_name: string;
  date_time: string;
  settings: InvitationSettings;
  created_at: string;
};
