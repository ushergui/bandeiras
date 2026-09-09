-- ===========================================================================
--  Fase 34C — SALA "Conhecimento é Poder" (telão + celulares)
--  Rode UMA vez no SQL Editor. Idempotente.
--
--  O jogo em si roda por Realtime broadcast no canal "party-<CODE>" — esta
--  tabela guarda só o mapa código→anfitrião (pra validar o código antes de
--  entrar) e o placar final.
-- ===========================================================================

create table if not exists public.party_rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  host_user   uuid not null references auth.users(id) on delete cascade,
  host_name   text not null,
  status      text not null default 'lobby'
              check (status in ('lobby','playing','done','closed')),
  config      jsonb,
  results     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ix_party_code on public.party_rooms (code) where status <> 'closed';

alter table public.party_rooms enable row level security;

-- qualquer um (até sem login) pode consultar um código pra entrar
drop policy if exists p_party_sel on public.party_rooms;
create policy p_party_sel on public.party_rooms for select using (true);
-- só o anfitrião cria / mexe na própria sala
drop policy if exists p_party_ins on public.party_rooms;
create policy p_party_ins on public.party_rooms for insert to authenticated
  with check (host_user = auth.uid());
drop policy if exists p_party_upd on public.party_rooms;
create policy p_party_upd on public.party_rooms for update to authenticated
  using (host_user = auth.uid()) with check (host_user = auth.uid());

grant select on public.party_rooms to anon, authenticated;
grant insert, update on public.party_rooms to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.party_rooms;
exception when duplicate_object then null;
end $$;

-- fecha salas velhas (rode de vez em quando, ou deixe um cron):
--   update public.party_rooms set status = 'closed'
--   where status <> 'closed' and created_at < now() - interval '6 hours';

-- pronto.
