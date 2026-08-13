// admin-invite-user — OPTIVISION
// Adaptado de qa-hub: crea usuarios con roles ADMIN | VENDEDOR
// y registra la acción en audit_log

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-api-key, x-client-info, apikey",
};

interface InvitePayload {
  action?: string;       // 'create' (default) | 'reset'
  email: string;
  role?: string;         // 'VENDEDOR' (default) | 'ADMIN'
  store_id?: string;     // Tienda asignada (para VENDEDOR)
  user_id?: string;      // Para action=reset
  invited_by?: string;   // Email del admin que ejecuta
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `Opt-${seg()}-${seg()}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  // API Key auth
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("AGENT_API_KEY");
  if (!expectedKey) return jsonError("Server misconfiguration: AGENT_API_KEY not set", 500);
  if (!apiKey || apiKey !== expectedKey) return jsonError("Unauthorized: invalid or missing x-api-key", 401);

  let payload: InvitePayload;
  try { payload = await req.json(); }
  catch { return jsonError("Invalid JSON body", 400); }

  const { action = 'create', email, role: rawRole, store_id, user_id, invited_by } = payload;
  const VALID_ROLES = ['ADMIN', 'VENDEDOR'];
  const assignedRole = VALID_ROLES.includes(rawRole ?? '') ? rawRole! : 'VENDEDOR';

  if (!email && action !== 'reset') return jsonError("Missing required field: email", 400);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) return jsonError("Invalid email format", 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonError('Server misconfiguration', 500);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── RESET PASSWORD ────────────────────────────────────────────
  if (action === 'reset') {
    if (!user_id && !email) return jsonError('Missing user_id or email for reset', 400);
    const newPassword = generatePassword();
    let targetUserId = user_id;

    if (!targetUserId && email) {
      const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const found = usersData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) return jsonError(`User not found: ${email}`, 404);
      targetUserId = found.id;
    }

    const { error } = await adminClient.auth.admin.updateUserById(targetUserId!, { password: newPassword });
    if (error) return jsonError(`Password reset failed: ${error.message}`, 500);

    // Audit log
    try {
      await adminClient.from("audit_log").insert({
        user_email: invited_by ?? "admin",
        action: "USUARIO_RESETEADO",
        entity_type: "USER",
        entity_id: targetUserId,
        description: `Password reseteado para ${email}`,
      });
    } catch { /* non-fatal */ }

    return jsonResponse({ success: true, action: 'reset', email, new_password: newPassword });
  }

  // ── CREATE USER ───────────────────────────────────────────────
  try {
    const generatedPassword = generatePassword();
    let userId: string;

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
    });

    if (createError) {
      const alreadyExists = createError.message?.toLowerCase().includes('already') ||
        createError.message?.toLowerCase().includes('registered') ||
        createError.message?.toLowerCase().includes('exists');
      if (!alreadyExists) throw new Error(`User creation failed: ${createError.message}`);

      const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (listError || !usersData) throw new Error(`Failed to list users: ${listError?.message ?? 'no data'}`);
      const existingUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!existingUser) throw new Error(`User already exists but could not be found: ${email}`);
      userId = existingUser.id;
    } else {
      if (!createData?.user?.id) throw new Error('User created but no user id returned');
      userId = createData.user.id;
    }

    // Upsert profile
    const { error: profileError } = await adminClient.from("profiles").upsert(
      { id: userId, email, role: assignedRole, store_id: store_id || null },
      { onConflict: "id" }
    );
    if (profileError) throw new Error(`Profile upsert failed: ${profileError.message}`);

    // Audit log
    try {
      await adminClient.from("audit_log").insert({
        user_email: invited_by ?? "admin",
        action: "USUARIO_CREADO",
        entity_type: "USER",
        entity_id: userId,
        description: `Usuario creado: ${email} con rol ${assignedRole}`,
      });
    } catch { /* non-fatal */ }

    return jsonResponse({
      success: true, action: 'create',
      user_id: userId, email, role: assignedRole,
      generated_password: generatedPassword,
      message: `Cuenta ${assignedRole} creada. Comparte la contraseña con el usuario.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-invite-user] Error:", message);
    return jsonError(message, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ success: false, error: message }, status);
}
