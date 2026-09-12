-- ============================================================================
--  RESET GERAL (12/09): zera o progresso de TODOS os jogadores -- ninguém
--  fica com nenhuma bandeira conhecida, nenhuma figurinha, nenhuma conquista,
--  nenhuma jornada, nenhum pacote guardado, nenhum ranking, troca ou duelo
--  pendente. As CONTAS (login/senha, em public.profiles) NÃO são apagadas --
--  todo mundo continua entrando com o mesmo usuário e senha de sempre.
--
--  Depois de rodar isto, não precisa fazer mais nada: na PRÓXIMA vez que cada
--  um abrir o jogo (ou trocar de conta), o app credita sozinho os 2 pacotes
--  grátis do dia -- é a mesma lógica de sempre ("2 pacotes grátis, reseta às
--  6h da manhã"), só que agora nenhuma conta ainda puxou o de hoje.
--
--  Detalhe só pra quem já testou o jogo HOJE no mesmo aparelho/navegador: o
--  app também guarda um bilhete local (localStorage) avisando "já peguei o
--  pacote de hoje". Se for o caso, ou espera virar o dia (6h), ou limpa os
--  dados do site nesse navegador (ou usa uma aba anônima) pra ver os 2
--  pacotes na hora -- em qualquer aparelho que ainda não jogou hoje, já cai
--  automático, sem precisar disso.
--
--  Roda tudo de uma vez no SQL Editor do Supabase. "restart identity" também
--  zera a numeração (ranking volta a contar de 1).
-- ============================================================================

truncate table
  public.country_progress,
  public.stickers,
  public.packs,
  public.daily_progress,
  public.journey,
  public.achievements,
  public.ranking,
  public.trades,
  public.duels,
  public.live_duels,
  public.party_rooms
restart identity cascade;
