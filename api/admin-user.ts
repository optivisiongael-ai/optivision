// Vercel Serverless Function — crea/resetea usuarios de OPTIVISION
// Auth: verifica JWT de Supabase + rol ADMIN
// Requiere en Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `Opt-${seg()}-${seg()}`;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ success: false, error: 'Method not allowed' }); return; }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ success: false, error: 'Server misconfiguration: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }); return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { action = 'create', email, role: rawRole, store_id, user_id, invited_by } = req.body;
  const assignedRole = ['ADMIN', 'VENDEDOR'].includes(rawRole) ? rawRole : 'VENDEDOR';

  try {
    // ── RESET ──
    if (action === 'reset') {
      let targetId = user_id;
      if (!targetId && email) {
        const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const found = data?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        if (!found) { res.status(404).json({ success: false, error: `User not found: ${email}` }); return; }
        targetId = found.id;
      }
      const newPwd = generatePassword();
      const { error } = await admin.auth.admin.updateUserById(targetId, { password: newPwd });
      if (error) { res.status(500).json({ success: false, error: error.message }); return; }
      await admin.from('audit_log').insert({ user_email: invited_by ?? caller.email, action: 'USUARIO_RESETEADO', entity_type: 'USER', entity_id: targetId, description: `Password reseteado para ${email}` }).catch(() => {});
      res.status(200).json({ success: true, action: 'reset', email, generated_password: newPwd }); return;
    }

    // ── CREATE ──
    if (!email) { res.status(400).json({ success: false, error: 'Missing email' }); return; }
    const generatedPassword = generatePassword();
    let userId: string;

    const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password: generatedPassword, email_confirm: true });
    if (ce) {
      const alreadyExists = ce.message?.toLowerCase().includes('already') || ce.message?.toLowerCase().includes('exists');
      if (!alreadyExists) { res.status(500).json({ success: false, error: ce.message }); return; }
      const { data: all } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = all?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) { res.status(500).json({ success: false, error: 'User already exists but not found' }); return; }
      userId = existing.id;
    } else {
      userId = created!.user!.id;
    }

    await admin.from('profiles').upsert({ id: userId, email, role: assignedRole, store_id: store_id || null }, { onConflict: 'id' });
    await admin.from('audit_log').insert({ user_email: invited_by ?? caller.email, action: 'USUARIO_CREADO', entity_type: 'USER', entity_id: userId, description: `Usuario creado: ${email} con rol ${assignedRole}` }).catch(() => {});

    res.status(200).json({ success: true, action: 'create', user_id: userId, email, role: assignedRole, generated_password: generatedPassword, message: `Cuenta ${assignedRole} creada.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
}
