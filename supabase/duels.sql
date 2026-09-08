-- ===========================================================================
--  Fase 34 — DESAFIOS ENTRE AMIGOS (assíncrono)
--  Rode isto UMA vez no SQL Editor do Supabase (depois do schema.sql).
--  É idempotente: pode rodar de novo sem problema.
-- ===========================================================================

create table if not exists public.duels (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'async' check (kind in ('async','live')),
  mode          text not null,                 -- BandeiraPorPais, NomePorBandeira, ...
  difficulty    int  not null default 1,
  questions     jsonb not null,                -- [{ "code": "...", "opts": ["...","..."] }]
  from_user     uuid not null references auth.users(id) on delete cascade,
  from_username text not null,
  to_user       uuid references auth.users(id) on delete cascade,   -- null = mural
  to_username   text,
  from_score    int,
  to_score      int,
  from_done     boolean not null default false,
  to_done       boolean not null default false,
  status        text not null default 'aberto'
                check (status in ('aberto','completo','cancelado')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists ix_duels_from on public.duels (from_user);
create index if not exists ix_duels_to   on public.duels (to_user);
create index if not exists ix_duels_mural on public.duels (status, created_at desc)
  where kind = 'async' and to_user is null and status = 'aberto';

alter table public.duels enable row level security;

-- vejo: os meus (dei ou recebi) + murais abertos de outra gente
drop policy if exists p_duels_sel on public.duels;
create policy p_duels_sel on public.duels for select to authenticated using (
  from_user = auth.uid()
  or to_user = auth.uid()
  or (to_user is null and status = 'aberto')
);
-- crio só como from_user
drop policy if exists p_duels_ins on public.duels;
create policy p_duels_ins on public.duels for insert to authenticated
  with check (from_user = auth.uid());
-- update/delete: só via RPC (SECURITY DEFINER)

-- --------------------------------------------------------------------------
--  RPC: entrar/responder um desafio
--  - se for mural aberto, o primeiro que chamar vira o to_user
--  - grava o placar do lado de quem chamou
--  - quando os dois terminam, status = 'completo'
-- --------------------------------------------------------------------------
create or replace function public.submit_duel_score(p_duel uuid, p_score int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d  public.duels;
  me uuid := auth.uid();
  myname text;
begin
  select * into d from public.duels where id = p_duel for update;
  if not found then return jsonb_build_object('error','Esse desafio não existe mais.'); end if;
  if d.status = 'cancelado' then return jsonb_build_object('error','Esse desafio foi cancelado.'); end if;

  -- mural aberto: quem chega primeiro (que não seja o dono) assume o outro lado
  if d.to_user is null and d.from_user <> me then
    select username into myname from public.profiles where id = me;
    update public.duels set to_user = me, to_username = coalesce(myname,'?') where id = p_duel;
    d.to_user := me;
  end if;

  if me = d.from_user then
    if d.from_done then return jsonb_build_object('error','Você já jogou este desafio.'); end if;
    update public.duels set from_score = p_score, from_done = true where id = p_duel;
    d.from_done := true; d.from_score := p_score;
  elsif me = d.to_user then
    if d.to_done then return jsonb_build_object('error','Você já jogou este desafio.'); end if;
    update public.duels set to_score = p_score, to_done = true where id = p_duel;
    d.to_done := true; d.to_score := p_score;
  else
    return jsonb_build_object('error','Esse desafio não é seu.');
  end if;

  if d.from_done and d.to_done then
    update public.duels set status = 'completo', resolved_at = now() where id = p_duel;
    d.status := 'completo';
  end if;

  return jsonb_build_object('ok', true,
    'status', d.status,
    'from_score', d.from_score, 'to_score', d.to_score,
    'from_done', d.from_done, 'to_done', d.to_done);
end $$;

create or replace function public.cancel_duel(p_duel uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.duels set status = 'cancelado', resolved_at = now()
  where id = p_duel and from_user = auth.uid() and status = 'aberto' and not to_done;
  if not found then return jsonb_build_object('error','Não deu pra cancelar.'); end if;
  return jsonb_build_object('ok', true);
end $$;

grant select, insert on public.duels to authenticated;
grant execute on function public.submit_duel_score(uuid, int) to authenticated;
grant execute on function public.cancel_duel(uuid) to authenticated;

alter publication supabase_realtime add table public.duels;

-- pronto.
