-- ===========================================================================
--  Fase 34B — DUELO AO VIVO (tempo real)
--  Rode UMA vez no SQL Editor. Idempotente.
--
--  Fluxo: host cria (status 'aguardando') -> convidado/qualquer amigo entra
--  (join_live_duel -> 'pronto') -> host dá o start (start_live_duel ->
--  'jogando', started_at) -> os dois jogam as MESMAS 8 perguntas com timer,
--  trocando o placar por Realtime broadcast -> cada um manda finish_live_duel
--  -> quando os dois terminam, calcula o vencedor -> 'terminado'.
--  Se um cai no meio, o outro chama forfeit_live_duel e vence.
-- ===========================================================================

create table if not exists public.live_duels (
  id           uuid primary key default gen_random_uuid(),
  mode         text not null,
  difficulty   int  not null default 1,
  questions    jsonb not null,
  host_user    uuid not null references auth.users(id) on delete cascade,
  host_name    text not null,
  host_avatar  text not null default '🌍',
  guest_user   uuid references auth.users(id) on delete cascade,
  guest_name   text,
  guest_avatar text,
  invited_user uuid references auth.users(id) on delete set null,  -- null = lobby aberto
  host_score   int,
  guest_score  int,
  host_done    boolean not null default false,
  guest_done   boolean not null default false,
  winner       uuid,
  status       text not null default 'aguardando'
               check (status in ('aguardando','pronto','jogando','terminado','cancelado')),
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  resolved_at  timestamptz
);
create index if not exists ix_live_from  on public.live_duels (host_user);
create index if not exists ix_live_to    on public.live_duels (guest_user);
create index if not exists ix_live_lobby on public.live_duels (status, created_at desc)
  where status = 'aguardando' and guest_user is null and invited_user is null;

alter table public.live_duels enable row level security;

drop policy if exists p_live_sel on public.live_duels;
create policy p_live_sel on public.live_duels for select to authenticated using (
  host_user = auth.uid()
  or guest_user = auth.uid()
  or invited_user = auth.uid()
  or (status = 'aguardando' and guest_user is null and invited_user is null)
);
drop policy if exists p_live_ins on public.live_duels;
create policy p_live_ins on public.live_duels for insert to authenticated
  with check (host_user = auth.uid());

-- entra num duelo (convidado ou pega do lobby)
create or replace function public.join_live_duel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.live_duels; me uuid := auth.uid(); myname text; myav text;
begin
  select * into d from public.live_duels where id = p_id for update;
  if not found then return jsonb_build_object('error','Esse duelo não existe mais.'); end if;
  if d.status = 'cancelado' then return jsonb_build_object('error','Esse duelo foi cancelado.'); end if;
  if d.status = 'terminado' then return jsonb_build_object('error','Esse duelo já acabou.'); end if;
  if d.host_user = me then return jsonb_build_object('error','Você é o anfitrião.'); end if;
  if d.guest_user is not null and d.guest_user <> me then
    return jsonb_build_object('error','Alguém já entrou nesse duelo.');
  end if;
  if d.invited_user is not null and d.invited_user <> me then
    return jsonb_build_object('error','Esse convite não é pra você.');
  end if;
  select username, avatar into myname, myav from public.profiles where id = me;
  update public.live_duels
     set guest_user = me, guest_name = coalesce(myname,'?'), guest_avatar = coalesce(myav,'🌍'),
         status = case when status = 'aguardando' then 'pronto' else status end
   where id = p_id;
  select * into d from public.live_duels where id = p_id;
  return jsonb_build_object('ok', true, 'duel', row_to_json(d));
end $$;

-- host aperta "começar" (os dois já prontos)
create or replace function public.start_live_duel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.live_duels; me uuid := auth.uid();
begin
  select * into d from public.live_duels where id = p_id for update;
  if not found then return jsonb_build_object('error','Duelo não existe.'); end if;
  if d.host_user <> me then return jsonb_build_object('error','Só o anfitrião começa.'); end if;
  if d.guest_user is null then return jsonb_build_object('error','Ninguém entrou ainda.'); end if;
  if d.status not in ('aguardando','pronto') then
    return jsonb_build_object('ok', true, 'started_at', d.started_at, 'already', true);
  end if;
  update public.live_duels set status = 'jogando', started_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'started_at', now());
end $$;

-- cada lado manda seu placar; quando os dois terminam, define o vencedor
create or replace function public.finish_live_duel(p_id uuid, p_score int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.live_duels; me uuid := auth.uid();
begin
  select * into d from public.live_duels where id = p_id for update;
  if not found then return jsonb_build_object('error','Duelo não existe.'); end if;
  if d.status = 'terminado' then
    return jsonb_build_object('ok', true, 'status','terminado', 'winner', d.winner,
      'host_score', d.host_score, 'guest_score', d.guest_score);
  end if;

  if me = d.host_user then
    update public.live_duels set host_score = p_score, host_done = true where id = p_id;
    d.host_done := true; d.host_score := p_score;
  elsif me = d.guest_user then
    update public.live_duels set guest_score = p_score, guest_done = true where id = p_id;
    d.guest_done := true; d.guest_score := p_score;
  else
    return jsonb_build_object('error','Esse duelo não é seu.');
  end if;

  if d.host_done and d.guest_done then
    update public.live_duels
       set status = 'terminado', resolved_at = now(),
           winner = case when d.host_score > d.guest_score then d.host_user
                         when d.guest_score > d.host_score then d.guest_user
                         else null end
     where id = p_id;
    select * into d from public.live_duels where id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'status', d.status, 'winner', d.winner,
    'host_score', d.host_score, 'guest_score', d.guest_score,
    'host_done', d.host_done, 'guest_done', d.guest_done);
end $$;

-- o adversário caiu: quem chamar vence
create or replace function public.forfeit_live_duel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.live_duels; me uuid := auth.uid();
begin
  select * into d from public.live_duels where id = p_id for update;
  if not found then return jsonb_build_object('error','Duelo não existe.'); end if;
  if me not in (d.host_user, coalesce(d.guest_user, me)) then
    return jsonb_build_object('error','Esse duelo não é seu.');
  end if;
  if d.status = 'terminado' then
    return jsonb_build_object('ok', true, 'winner', d.winner);
  end if;
  update public.live_duels
     set status = 'terminado', resolved_at = now(), winner = me,
         host_done = true, guest_done = true
   where id = p_id;
  return jsonb_build_object('ok', true, 'winner', me, 'wo', true);
end $$;

create or replace function public.cancel_live_duel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.live_duels set status = 'cancelado', resolved_at = now()
  where id = p_id and host_user = auth.uid() and status in ('aguardando','pronto');
  if not found then return jsonb_build_object('error','Não deu pra cancelar.'); end if;
  return jsonb_build_object('ok', true);
end $$;

grant select, insert on public.live_duels to authenticated;
grant execute on function public.join_live_duel(uuid)          to authenticated;
grant execute on function public.start_live_duel(uuid)         to authenticated;
grant execute on function public.finish_live_duel(uuid, int)   to authenticated;
grant execute on function public.forfeit_live_duel(uuid)       to authenticated;
grant execute on function public.cancel_live_duel(uuid)        to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.live_duels;
exception when duplicate_object then null;
end $$;

-- pronto.
