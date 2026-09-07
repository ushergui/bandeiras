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

1. Menu **Authentication** → **Providers** → **Email**:
   - **Desligue** "Confirm email" (os e-mails do jogo são sintéticos e fake).
   - Deixe "Secure email change" como está.
   - Salve.
2. **Authentication** → **URL Configuration**:
   - **Site URL**: por enquanto `http://localhost:8010` (troca depois pela URL do
     Netlify).
   - Salve.
3. (Opcional, recomendado) **Authentication** → **Rate Limits**: pode deixar o
   padrão.

## 4. Pegar a URL e a chave

1. Menu **Project Settings** (engrenagem) → **API**.
2. Copie:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **Project API keys → `anon` `public`** (uma chave longa começando com `eyJ...`)
3. Abra **`js/config.js`** deste repositório e preencha:
   ```js
   window.DG_CONFIG = {
     SUPABASE_URL: "https://abcdefgh.supabase.co",
     SUPABASE_ANON_KEY: "eyJ...cole a anon aqui...",
   };
   ```
   > A chave `anon` é **pública** por design — o RLS no banco é quem protege os
   > dados. **Nunca** ponha aqui a chave `service_role`.
4. Commite: `git add js/config.js && git commit -m "config: liga o Supabase"`.

## 5. Testar local

```bash
git pull                              # se editou o config noutro lugar
python -m http.server 8010            # ou tools\jogo.bat
```
Abra `http://localhost:8010` → **Criar conta** → jogue uma partida → recarregue.
O progresso tem que continuar lá (agora vem da nuvem).

No painel do Supabase → **Table Editor** → confira as tabelas `profiles`,
`stickers`, `country_progress`, `ranking` populando.

## 6. Publicar no Netlify

1. <https://netlify.com> → login com GitHub → **Add new site → Import an existing
   project** → escolha este repositório.
2. Configuração:
   - Branch: `main` (ou `reforma-pwa-2026` enquanto não fez o merge)
   - **Build command**: (vazio)
   - **Publish directory**: `.`
   - Deploy.
3. Netlify te dá uma URL (`https://algo.netlify.app`). Pode trocar o nome em
   **Site configuration → Change site name**.

## 7. Fechar o círculo

1. Volte no Supabase → **Authentication → URL Configuration**:
   - **Site URL**: a URL do Netlify.
   - **Redirect URLs**: adicione `https://SUA-URL.netlify.app/**`.
2. Abra a URL do Netlify no celular → **Adicionar à tela inicial** → crie a conta →
   jogue. Instale em 2 aparelhos com a mesma conta pra ver o progresso sincronizar.

---

## Nuances / limitações desta fase

- **Sem "esqueci a senha"** — os e-mails são fake. Se esquecer, cria outra conta.
- **Offline**: depois do 1º login, o app joga sem internet (pacotes, álbum,
  progresso salvam no aparelho) e sincroniza quando a conexão volta. **Não jogue
  a mesma conta offline em 2 aparelhos ao mesmo tempo** — a última sincronização
  vence e pode perder um pouco de progresso.
- **Conquistas e metas do dia** ainda são por-aparelho (não sincronizam). O
  streak de login e todo o resto, sim.
- **Multiplayer de sala (PeerJS)** não usa o Supabase — continua sendo na mesma
  rede local.
- Custo: plano free do Supabase aguenta tranquilo um jogo assim (500 MB de
  banco, 50 mil usuários/mês). O Netlify free idem.
