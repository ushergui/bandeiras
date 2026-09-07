# Modo online — passo a passo (Supabase + Netlify)

O jogo funciona 100% local sem isto. Para ativar contas de verdade, ranking
global e trocas entre pessoas, siga os passos. Leva ~20 minutos. Tudo no plano
gratuito.

---

## 1. Criar o projeto no Supabase

1. Entre em <https://supabase.com> → **Start your project** → login com GitHub.
2. **New project**:
   - **Organization**: a sua (FREE).
   - **GitHub (optional)**: deixe **em branco** (a gente cola o schema na mão).
   - **Project name**: qualquer coisa (ex.: `Bandeiras`).
   - **Database password**: use a que ele gerou, clique **Copy** e **guarde**
     (não precisa no jogo — é a senha do Postgres).
   - **Region**: `South America (São Paulo)`.
   - **Security**:
     - ✅ **Enable Data API** — deixe **marcado** (é a API REST que o jogo usa).
     - ✅ **Automatically expose new tables** — pode deixar **marcado**; o schema
       já liga RLS em todas as tabelas, então não vaza nada. (Se preferir
       desmarcar, tudo bem também — o schema tem `grant`s que cobrem isso.)
     - ⬜ **Enable automatic RLS** — pode deixar **desmarcado**; o schema já
       ativa RLS em cada tabela explicitamente.
   - **Advanced → Postgres Type**: `Postgres (DEFAULT)`. Não use OrioleDB (alpha).
   - **Create new project** (demora ~2 min pra provisionar).

## 2. Rodar o esquema do banco

1. No projeto → menu lateral **SQL Editor** → **New query**.
2. Abra o arquivo **`supabase/schema.sql`** deste repositório, copie **tudo**,
   cole no editor.
3. **Run** (canto inferior direito). Deve terminar com "Success. No rows returned".
   - Pode rodar de novo quando quiser (é idempotente).

## 3. Ajustar a autenticação

1. Menu **Authentication** → **Sign In / Providers** (em versões antigas:
   **Providers**) → seção **Email**:
   - **Desligue "Confirm email"** (os e-mails do jogo são sintéticos e fake — se
     ficar ligado, ninguém consegue entrar).
   - **Desligue "Allow new users to sign up"** — assim só *você* cria contas
     (pelo painel, passo 5b). O jogo também já não mostra o botão "Criar conta"
     porque `ALLOW_SIGNUP: false` no `js/config.js`.
   - Deixe "Secure email change" como está. Salve.
2. **Authentication** → **URL Configuration**:
   - **Site URL**: por enquanto `http://localhost:8010` (troca depois pela URL do
     Netlify).
   - Salve.

## 4. Pegar a URL e a chave

1. Menu **Project Settings** (engrenagem) → **API** (ou **API Keys**).
2. Copie:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - Uma chave **pública**: serve tanto a `anon` `public` legada (começa com
     `eyJ...`) quanto a nova **`publishable`** (começa com `sb_publishable_...`).
3. Abra **`js/config.js`** e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
   Deixe `ALLOW_SIGNUP: false`.
   > A chave pública é **pública** por design — o RLS no banco é quem protege os
   > dados. **Nunca** ponha aqui a `service_role` nem a `sb_secret_...`.
4. Commite: `git add js/config.js && git commit -m "config: liga o Supabase"`.

## 5. Criar as contas e testar local

**5a. Testar** — `python -m http.server 8010` (ou `tools\jogo.bat`), abra
`http://localhost:8010`. Só aparece **"Entrar"** (o cadastro está fechado).

**5b. Criar uma conta** (só você faz isto, no painel):
1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
2. **Email**: `nomedapessoa@detetiveglobal.app` — tudo minúsculo, sem espaço
   (troque espaço por `-`). O jogo monta esse e-mail sozinho a partir do
   "usuário" que a pessoa digita.
3. **Password**: você escolhe. **Marque "Auto Confirm User"**. → Create.
4. Passe pra pessoa só o **usuário** (a parte antes do `@`) e a **senha**.
5. No 1º login o jogo cria o perfil + os 2 pacotes iniciais sozinho.

> **Guarde uma lista** com usuário + senha de cada um. Não há "esqueci a senha".

**5c. Conferir** — entre com a conta, jogue uma partida, recarregue: o progresso
continua (veio da nuvem). No **Table Editor** as tabelas `profiles`, `stickers`,
`country_progress`, `ranking` devem estar populando.

## 6. Publicar no Netlify

1. <https://netlify.com> → login com GitHub → **Add new site → Import an existing
   project** → escolha este repositório.
2. Configuração:
   - Branch: `main` (ou `reforma-pwa-2026` enquanto não fez o merge)
   - **Build command** e **Publish directory**: deixe como o Netlify sugerir — o
     `netlify.toml` do repo já manda o certo (publica `.` e remove as pastas de
     desenvolvimento `tools/`, `docs/`, `supabase/`, etc. do que vai pro ar).
   - Deploy.
3. Netlify te dá uma URL (`https://algo.netlify.app`). Pode trocar o nome em
   **Site configuration → Change site name**.

## 7. Fechar o círculo

1. Volte no Supabase → **Authentication → URL Configuration**:
   - **Site URL**: a URL do Netlify.
   - **Redirect URLs**: adicione `https://SUA-URL.netlify.app/**`.
2. Abra a URL do Netlify no celular → **Adicionar à tela inicial** → entre com
   uma conta → jogue. Instale em 2 aparelhos com a mesma conta pra ver o
   progresso sincronizar.

---

## Nuances / limitações desta fase

- **Sem "esqueci a senha"** — os e-mails são fake. Você (dono) recria a conta
  pelo painel e passa uma senha nova; o progresso da conta antiga fica perdido a
  menos que você troque só a senha do mesmo usuário em **Authentication → Users**.
- **Free-tier pausa o projeto** depois de ~1 semana sem *nenhum* acesso. Volta
  sozinho quando alguém abre o jogo (a 1ª carga demora ~1 min). **Os dados não
  são apagados.** Só some se ficar ~90 dias parado.
- **Offline**: depois do 1º login, o app joga sem internet (pacotes, álbum,
  progresso salvam no aparelho) e sincroniza quando a conexão volta. **Não jogue
  a mesma conta offline em 2 aparelhos ao mesmo tempo** — a última sincronização
  vence e pode perder um pouco de progresso.
- **Conquistas e metas do dia** ainda são por-aparelho (não sincronizam). O
  streak de login, progresso, figurinhas, pacotes, ranking e trocas, sim.
- **Multiplayer de sala (PeerJS)** não usa o Supabase — continua sendo na mesma
  rede local.
- Custo: plano free do Supabase aguenta tranquilo um jogo assim (500 MB de
  banco, 50 mil usuários/mês). O Netlify free idem.
