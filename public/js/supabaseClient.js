import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm';

const config = window.__CHRONICA_CONFIG__ || {};

if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
  console.error('Configure SUPABASE_URL e SUPABASE_ANON_KEY em public/config.js');
}

export const supabase = createClient(config.SUPABASE_URL || '', config.SUPABASE_ANON_KEY || '', {
  auth: {
    persistSession: true,
    detectSessionInUrl: true
  }
});

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function getAccessToken() {
  const session = await getCurrentSession();
  return session?.access_token || null;
}
