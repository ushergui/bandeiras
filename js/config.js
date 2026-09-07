// ============================================================
//  Detetive Global — configuração do modo online
// ------------------------------------------------------------
//  SUPABASE_ANON_KEY aceita tanto a chave "anon" (legado, eyJ...)
//  quanto a nova "publishable" (sb_publishable_...). As duas são
//  PÚBLICAS por design — o RLS no banco é quem protege os dados.
//  NUNCA ponha aqui a "service_role" nem a "sb_secret_...".
//
//  Deixe as duas strings VAZIAS para rodar 100% local (sem nuvem).
//  Passo a passo completo: docs/ONLINE_SETUP.md
// ============================================================
window.DG_CONFIG = {
  SUPABASE_URL: "https://mcuwlydjlroedwuansri.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_7mPDqSVgfqiD3Cf8--EkxA_jW7mZKmC",
};
