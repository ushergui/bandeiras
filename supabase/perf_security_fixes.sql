-- ============================================================================
--  Correcoes apontadas pelo Advisor do Supabase (12/09):
--
--  1) "Security Definer View" (CRITICAL) em public.ranking_best
--     Toda view roda com o dono dela pra fins de RLS, a nao ser que marque
--     security_invoker=on -- ai ela passa a rodar com as permissoes de quem
--     esta CONSULTANDO. Como ranking ja e publica de proposito, o risco real
--     aqui e baixo, mas e boa pratica (se um dia a policy de ranking ficar
--     mais restrita, essa view ja respeita sem precisar lembrar dela).
--
--  2) "Auth RLS Initialization Plan" (aviso de performance, nao seguranca)
--     em profiles/country_progress/stickers/packs/daily_progress/journey/
--     achievements/ranking/trades/duels/live_duels/party_rooms.
--     Toda policy que chama auth.uid() direto faz o Postgres reavaliar a
--     funcao LINHA POR LINHA. Trocando por (select auth.uid()) o Postgres
--     resolve so 1 vez por consulta (vira um "InitPlan"). Pra este jogo
--     (poucos usuarios, tabelas pequenas) o ganho e desprezivel na pratica,
--     mas e de graca e deixa o Advisor limpo.
--
--  Roda tudo de uma vez no SQL Editor do Supabase. Idempotente (pode rodar
--  de novo sem problema).
-- ============================================================================

-- ---- 1) view sem SECURITY DEFINER implicito ----
alter view public.ranking_best set (security_invoker = on);

-- ---- 2) policies com (select auth.uid()) em vez de auth.uid() ----
alter policy p_profiles_ins on public.profiles
  with check (id = (select auth.uid()));
alter policy p_profiles_upd on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy p_country_progress_all on public.country_progress
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy p_stickers_all on public.stickers
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy p_packs_all on public.packs
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy p_daily_progress_all on public.daily_progress
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy p_journey_all on public.journey
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy p_achievements_all on public.achievements
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy p_ranking_ins on public.ranking
  with check (user_id = (select auth.uid()));

alter policy p_trades_sel on public.trades
  using (
    from_user = (select auth.uid()) or to_user = (select auth.uid())
    or (kind = 'mural' and status = 'aberta')
  );
alter policy p_trades_ins on public.trades
  with check (from_user = (select auth.uid()));

alter policy p_duels_sel on public.duels
  using (
    from_user = (select auth.uid()) or to_user = (select auth.uid())
    or (to_user is null and status = 'aberto')
  );
alter policy p_duels_ins on public.duels
  with check (from_user = (select auth.uid()));

alter policy p_live_sel on public.live_duels
  using (
    host_user = (select auth.uid()) or guest_user = (select auth.uid())
    or invited_user = (select auth.uid())
    or (status = 'aguardando' and guest_user is null and invited_user is null)
  );
alter policy p_live_ins on public.live_duels
  with check (host_user = (select auth.uid()));

alter policy p_party_ins on public.party_rooms
  with check (host_user = (select auth.uid()));
alter policy p_party_upd on public.party_rooms
  using (host_user = (select auth.uid())) with check (host_user = (select auth.uid()));
