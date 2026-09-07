-- ============================================================================
--  Detetive Global — esquema do modo online (Supabase / Postgres)
--  Cole TUDO isto no SQL Editor do seu projeto Supabase e clique em "Run".
--  Pode rodar de novo com segurança (usa "if not exists" / "or replace").
-- ============================================================================

-- ---------------------------------------------------------------------------
--  helper: updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
--  profiles  (1 por usuário; id = auth.uid)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text not null,
  username_lower text not null unique,
  avatar         text not null default '🌍',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
drop trigger if exists t_profiles_touch on public.profiles;
create trigger t_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  country_progress  (aprendizado por país/estado)
-- ---------------------------------------------------------------------------
create table if not exists public.country_progress (
  user_id        uuid not null references auth.users(id) on delete cascade,
  code           text not null,
  acertos        int  not null default 0,
  erros          int  not null default 0,
  streak         int  not null default 0,
  ease           real not null default 2.3,
  mastery        int  not null default 0,
  last_seen_at   timestamptz,
  next_review_at timestamptz,
  avg_ms         int,
  hist           jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (user_id, code)
);
drop trigger if exists t_cp_touch on public.country_progress;
create trigger t_cp_touch before update on public.country_progress
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  stickers  (figurinhas: colada + pilha)
--    pilha = array de raridade: base | shiny | roxa | bronze | prata | ouro
-- ---------------------------------------------------------------------------
create table if not exists public.stickers (
  user_id    uuid not null references auth.users(id) on delete cascade,
  codigo     text not null,
  colada     text,
  pilha      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, codigo)
);
drop trigger if exists t_stk_touch on public.stickers;
create trigger t_stk_touch before update on public.stickers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  packs  (contagem + diário + streak de login)
-- ---------------------------------------------------------------------------
create table if not exists public.packs (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  count         int  not null default 0,
  last_daily_at date,
  streak_count  int  not null default 0,
  streak_last   date,
  updated_at    timestamptz not null default now()
);
drop trigger if exists t_packs_touch on public.packs;
create trigger t_packs_touch before update on public.packs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  daily_progress  (metas do dia -> pacotes bônus)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  acertos    int  not null default 0,
  mastered   int  not null default 0,
  modes      jsonb not null default '{}'::jsonb,
  bonus      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
drop trigger if exists t_dp_touch on public.daily_progress;
create trigger t_dp_touch before update on public.daily_progress
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  journey  (nível da Jornada)
-- ---------------------------------------------------------------------------
create table if not exists public.journey (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  level      int  not null default 1,
  updated_at timestamptz not null default now()
);
drop trigger if exists t_journey_touch on public.journey;
create trigger t_journey_touch before update on public.journey
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  achievements  (conquistas desbloqueadas)
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------------------
--  ranking  (leitura pública)
-- ---------------------------------------------------------------------------
create table if not exists public.ranking (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  username   text not null,
  avatar     text not null default '🌍',
  score      int  not null,
  mode       text not null,
  played_at  timestamptz not null default now()
);
create index if not exists ix_ranking_mode_score on public.ranking (mode, score desc);
create index if not exists ix_ranking_played on public.ranking (played_at desc);

-- melhor pontuação por jogador/modo
create or replace view public.ranking_best as
  select distinct on (user_id, mode)
    user_id, username, avatar, score, mode, played_at
  from public.ranking
  order by user_id, mode, score desc, played_at desc;

-- ---------------------------------------------------------------------------
--  trades  (mural + oferta direta)
--    offer / request = jsonb array de { "codigo": "...", "rarity": "base" }
-- ---------------------------------------------------------------------------
create table if not exists public.trades (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'mural' check (kind in ('mural','direto')),
  from_user     uuid not null references auth.users(id) on delete cascade,
  to_user       uuid references auth.users(id) on delete cascade,
  from_username text not null,
  to_username   text,
  offer         jsonb not null,
  request       jsonb not null,
  status        text not null default 'aberta'
                check (status in ('aberta','aceita','recusada','cancelada','expirada')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists ix_trades_open on public.trades (status, created_at desc)
  where status = 'aberta';
create index if not exists ix_trades_from on public.trades (from_user);
create index if not exists ix_trades_to on public.trades (to_user);

-- ============================================================================
--  RLS
-- ============================================================================
alter table public.profiles         enable row level security;
alter table public.country_progress enable row level security;
alter table public.stickers         enable row level security;
alter table public.packs            enable row level security;
alter table public.daily_progress   enable row level security;
alter table public.journey          enable row level security;
alter table public.achievements     enable row level security;
alter table public.ranking          enable row level security;
alter table public.trades           enable row level security;

-- profiles: qualquer autenticado lê (parceiro de troca / nome no ranking); só a própria escreve
drop policy if exists p_profiles_sel on public.profiles;
create policy p_profiles_sel on public.profiles for select to authenticated using (true);
drop policy if exists p_profiles_ins on public.profiles;
create policy p_profiles_ins on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists p_profiles_upd on public.profiles;
create policy p_profiles_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- tabelas "só minhas"
do $$
declare t text;
begin
  foreach t in array array['country_progress','stickers','packs','daily_progress','journey','achievements']
  loop
    execute format('drop policy if exists p_%1$s_all on public.%1$s;', t);
    execute format('create policy p_%1$s_all on public.%1$s for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- ranking: leitura pública; inserir só a própria linha
drop policy if exists p_ranking_sel on public.ranking;
create policy p_ranking_sel on public.ranking for select using (true);
drop policy if exists p_ranking_ins on public.ranking;
create policy p_ranking_ins on public.ranking for insert to authenticated with check (user_id = auth.uid());

-- trades: vejo as minhas + murais abertos; crio só como from_user; update só via RPC
drop policy if exists p_trades_sel on public.trades;
create policy p_trades_sel on public.trades for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or (kind = 'mural' and status = 'aberta'));
drop policy if exists p_trades_ins on public.trades;
create policy p_trades_ins on public.trades for insert to authenticated with check (from_user = auth.uid());
-- (sem policy de UPDATE/DELETE: só as RPCs SECURITY DEFINER mexem no status)

-- ============================================================================
--  RPCs
-- ============================================================================

-- cria/garante o profile + a linha packs na 1a vez
create or replace function public.bootstrap_profile(p_username text, p_avatar text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, username_lower, avatar)
  values (auth.uid(), p_username, lower(p_username), coalesce(p_avatar,'🌍'))
  on conflict (id) do update set username = excluded.username,
                                 username_lower = excluded.username_lower,
                                 avatar = excluded.avatar;
  insert into public.packs (user_id, count) values (auth.uid(), 2)
  on conflict (user_id) do nothing;
end $$;

-- helpers de pilha (mais fraca primeiro)
create or replace function public._rar_rank(r text) returns int language sql immutable as $$
  select coalesce(array_position(array['base','shiny','roxa','bronze','prata','ouro'], r), 0);
$$;

-- raridade mais fraca de uma pilha jsonb
create or replace function public._pilha_weakest(p jsonb) returns text language sql immutable as $$
  select r from jsonb_array_elements_text(coalesce(p,'[]'::jsonb)) r
  order by public._rar_rank(r) limit 1;
$$;

-- remove UMA ocorrência da raridade `rar` de uma pilha jsonb
create or replace function public._pilha_remove_one(p jsonb, rar text) returns jsonb language sql immutable as $$
  with e as (
    select value r, row_number() over () rn from jsonb_array_elements_text(coalesce(p,'[]'::jsonb))
  ), hit as (
    select min(rn) rn from e where r = rar
  )
  select coalesce(jsonb_agg(r order by rn), '[]'::jsonb)
  from e where rn <> (select rn from hit);
$$;

-- aceitar uma troca (mural aberto: qualquer um; direto: só o to_user)
create or replace function public.accept_trade(p_trade uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tr        public.trades;
  me        uuid := auth.uid();
  partner   uuid;
  item      jsonb;
  cod       text;
  s_from    public.stickers;
  s_to      public.stickers;
  give_rar  text;
begin
  select * into tr from public.trades where id = p_trade for update;
  if not found then return jsonb_build_object('error','Troca não existe mais.'); end if;
  if tr.status <> 'aberta' then return jsonb_build_object('error','Essa troca já foi resolvida.'); end if;

  if tr.kind = 'direto' then
    if tr.to_user <> me then return jsonb_build_object('error','Essa oferta não é pra você.'); end if;
  else
    if tr.from_user = me then return jsonb_build_object('error','Você não pode aceitar a própria oferta.'); end if;
  end if;
  partner := tr.from_user;

  -- confere: quem ofertou ainda tem TUDO de `offer` na pilha;
  --          quem aceita ainda tem TUDO de `request` na pilha
  for item in select * from jsonb_array_elements(tr.offer) loop
    cod := item->>'codigo';
    select * into s_from from public.stickers where user_id = partner and codigo = cod;
    if not found or jsonb_array_length(s_from.pilha) < 1 then
      return jsonb_build_object('error','Quem ofertou já não tem "'||cod||'".');
    end if;
  end loop;
  for item in select * from jsonb_array_elements(tr.request) loop
    cod := item->>'codigo';
    select * into s_to from public.stickers where user_id = me and codigo = cod;
    if not found or jsonb_array_length(s_to.pilha) < 1 then
      return jsonb_build_object('error','Você já não tem "'||cod||'" pra dar.');
    end if;
  end loop;

  -- move `offer`: partner -> me  (dá a cópia mais fraca de cada codigo)
  for item in select * from jsonb_array_elements(tr.offer) loop
    cod := item->>'codigo';
    select * into s_from from public.stickers where user_id = partner and codigo = cod for update;
    give_rar := public._pilha_weakest(s_from.pilha);
    update public.stickers set pilha = public._pilha_remove_one(pilha, give_rar)
      where user_id = partner and codigo = cod;
    insert into public.stickers (user_id, codigo, pilha) values (me, cod, jsonb_build_array(give_rar))
    on conflict (user_id, codigo) do update set pilha = public.stickers.pilha || jsonb_build_array(give_rar);
  end loop;

  -- move `request`: me -> partner
  for item in select * from jsonb_array_elements(tr.request) loop
    cod := item->>'codigo';
    select * into s_to from public.stickers where user_id = me and codigo = cod for update;
    give_rar := public._pilha_weakest(s_to.pilha);
    update public.stickers set pilha = public._pilha_remove_one(pilha, give_rar)
      where user_id = me and codigo = cod;
    insert into public.stickers (user_id, codigo, pilha) values (partner, cod, jsonb_build_array(give_rar))
    on conflict (user_id, codigo) do update set pilha = public.stickers.pilha || jsonb_build_array(give_rar);
  end loop;

  update public.trades set status = 'aceita', to_user = me,
    to_username = (select username from public.profiles where id = me),
    resolved_at = now()
  where id = p_trade;

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cancel_trade(p_trade uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.trades set status = 'cancelada', resolved_at = now()
  where id = p_trade and from_user = auth.uid() and status = 'aberta';
  if not found then return jsonb_build_object('error','Não deu pra cancelar.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.reject_trade(p_trade uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.trades set status = 'recusada', resolved_at = now()
  where id = p_trade and to_user = auth.uid() and kind = 'direto' and status = 'aberta';
  if not found then return jsonb_build_object('error','Não deu pra recusar.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
--  Realtime: publicar a tabela trades
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.trades;

-- pronto.
