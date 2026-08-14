// Endpoint de diagnóstico TEMPORAL — borrar después de verificar
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const agentKey = process.env.AGENT_API_KEY || '';

  res.status(200).json({
    supabase_url_set: !!url,
    supabase_url_preview: url ? url.slice(0, 40) + '...' : 'NOT SET',
    service_role_key_set: !!key,
    service_role_key_length: key.length,
    // Anon key starts with "sb_publishable_" — service role starts with "eyJ"
    service_role_key_prefix: key ? key.slice(0, 15) : 'NOT SET',
    agent_api_key_set: !!agentKey,
    agent_api_key_preview: agentKey ? agentKey.slice(0, 10) + '...' : 'NOT SET',
  });
}
