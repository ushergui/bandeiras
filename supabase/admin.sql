-- ===========================================================================
--  Fase 35 — painel de contas (quem é o dono do jogo)
--  Rode UMA vez no SQL Editor. Depois marque a SUA conta como admin:
--    update public.profiles set is_admin = true where username_lower = 'SEU_USUARIO';
--  (troque SEU_USUARIO pelo seu usuário, minúsculo)
-- ===========================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- o próprio dono lê o flag pra decidir se mostra o botão de admin;
-- a policy de SELECT de profiles já permite (qualquer autenticado lê profiles).
-- ninguém consegue se auto-promover: a policy de UPDATE só deixa mexer
-- na própria linha, mas o front nunca escreve is_admin, e mesmo que tentasse
-- o RLS não impede — então garantimos por trigger:

create or replace function public.block_self_admin()
returns trigger language plpgsql as $$
begin
  -- um usuário logado no jogo (auth.uid não nulo) nunca muda is_admin;
  -- o SQL Editor (postgres, sem JWT) e o service_role passam livres.
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;

drop trigger if exists t_profiles_no_self_admin on public.profiles;
create trigger t_profiles_no_self_admin
  before update on public.profiles
  for each row execute function public.block_self_admin();

-- pronto. Agora rode o update acima com o seu usuário.
