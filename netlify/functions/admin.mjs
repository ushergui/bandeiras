// ===========================================================================
//  /.netlify/functions/admin  — painel de contas do Detetive Global
// ---------------------------------------------------------------------------
//  Só o DONO (profiles.is_admin = true) pode chamar. Usa a chave service_role
//  do Supabase, que fica APENAS aqui no servidor (variável de ambiente do
//  Netlify) — nunca vai pro código do jogo nem pro GitHub.
//
//  Variáveis de ambiente (Netlify → Site configuration → Environment variables):
//    SUPABASE_URL          = https://mcuwlydjlroedwuansri.supabase.co
//    SUPABASE_SERVICE_KEY  = a "service_role" secret key do Supabase
//
//  Ações (POST JSON):
//    { action: "list" }
//    { action: "create", username, password }
//    { action: "reset",  userId, password }
// ===========================================================================

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const EMAIL_DOMAIN = "@detetiveglobal.app";

const json = (status, body) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const adminHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "content-type": "application/json",
};

// quem é o chamador? (valida o token do jogo) — e ele é admin?
async function requireAdmin(authHeader) {
  const token = (authHeader || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "sem sessão" };

  const u = await fetch(`${URL}/auth/v1/user`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${token}` },
  });
  if (!u.ok) return { error: "sessão inválida" };
  const user = await u.json();

  const p = await fetch(
    `${URL}/rest/v1/profiles?id=eq.${user.id}&select=is_admin`,
    { headers: adminHeaders }
  );
  const rows = p.ok ? await p.json() : [];
  if (!rows[0] || rows[0].is_admin !== true) return { error: "só o dono do jogo pode fazer isso" };
  return { user };
}

const cleanUsername = (s) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "use POST" });
  if (!URL || !SERVICE)
    return json(500, { error: "servidor sem configuração (SUPABASE_URL / SUPABASE_SERVICE_KEY)" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "json inválido" }); }

  const gate = await requireAdmin(event.headers.authorization || event.headers.Authorization);
  if (gate.error) return json(403, { error: gate.error });

  // ---- listar contas ----
  if (body.action === "list") {
    const r = await fetch(`${URL}/auth/v1/admin/users?per_page=500`, { headers: adminHeaders });
    if (!r.ok) return json(502, { error: "não deu pra listar" });
    const { users = [] } = await r.json();
    const out = users
      .map((u) => ({
        id: u.id,
        username: (u.user_metadata && u.user_metadata.username) || u.email.replace(EMAIL_DOMAIN, ""),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        must_change: !!(u.user_metadata && u.user_metadata.must_change),
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
    return json(200, { users: out });
  }

  // ---- criar conta ----
  if (body.action === "create") {
    const username = cleanUsername(body.username);
    const password = String(body.password || "");
    if (username.length < 2 || username.length > 20)
      return json(400, { error: "usuário: de 2 a 20 letras/números" });
    if (password.length < 6) return json(400, { error: "senha temporária: mínimo 6 caracteres" });

    const r = await fetch(`${URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        email: username + EMAIL_DOMAIN,
        password,
        email_confirm: true,
        user_metadata: { username, must_change: true },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = /already been registered|duplicate/i.test(JSON.stringify(data))
        ? "Esse usuário já existe."
        : (data.msg || data.error_description || "não deu pra criar");
      return json(400, { error: msg });
    }
    return json(200, { ok: true, id: data.id, username });
  }

  // ---- resetar senha (NÃO mexe no progresso) ----
  if (body.action === "reset") {
    const userId = String(body.userId || "");
    const password = String(body.password || "");
    if (!userId) return json(400, { error: "faltou o usuário" });
    if (password.length < 6) return json(400, { error: "senha temporária: mínimo 6 caracteres" });

    // pega o metadata atual pra preservar o username
    const cur = await fetch(`${URL}/auth/v1/admin/users/${userId}`, { headers: adminHeaders });
    const curData = cur.ok ? await cur.json() : {};
    const meta = { ...(curData.user_metadata || {}), must_change: true };

    const r = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ password, user_metadata: meta }),
    });
    if (!r.ok) return json(400, { error: "não deu pra resetar" });
    return json(200, { ok: true });
  }

  return json(400, { error: "ação desconhecida" });
}
