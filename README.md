# ChronicaRPG

Frontend estático com HTML/CSS/JS e backend Node.js + Express + Socket.IO com persistência no Supabase.

## Pré-requisitos

- Node.js 18+
- Conta Supabase

## Configuração do Supabase

1. Crie um novo projeto no painel do Supabase.
2. No SQL Editor, aplique o conteúdo de `scripts/sql/schema.sql` para criar as tabelas e índices.
3. Ainda no SQL Editor, aplique `scripts/sql/rls.sql` para ativar RLS e políticas de acesso.
4. No menu **Authentication → Providers**, habilite Magic Link por e-mail.

## Variáveis de ambiente

Crie um arquivo `.env` na raiz com base em `.env.example`:

```env
# Front (publicar no Pages)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SERVER_BASE_URL=

# Server (privado)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
PORT=3000
CORS_ORIGIN=https://helrymccavalcante.github.io
```

Para o frontend publicado no GitHub Pages, crie um `public/config.js` com os mesmos valores (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SERVER_BASE_URL`). Nunca exponha a `SUPABASE_SERVICE_ROLE_KEY` no frontend.

## Instalação

```bash
npm install
```

## Executando localmente

Inicie o backend com recarregamento automático:

```bash
npm run dev:server
```

Ou em modo produção:

```bash
npm start
```

O frontend pode ser servido de maneira estática (por exemplo `npx serve public`). Ajuste `public/config.js` para apontar para o backend local (`SERVER_BASE_URL=http://localhost:3000`).

## Deploy

- **Frontend**: publique a pasta `public/` no GitHub Pages (ou outro host estático).
- **Backend**: faça deploy do servidor Express em plataformas como Render, Railway, Fly.io ou Heroku. Configure as variáveis de ambiente privadas na plataforma.

Atualize `public/config.js` com as URLs de produção.

## Scripts úteis

- `npm run sql:apply`: lembrete para aplicar os arquivos SQL manualmente no Supabase.

## Fluxos principais

- Autenticação via Magic Link do Supabase no frontend.
- Listagem e criação de salas persistidas em `rooms`/`room_members`.
- Chat e rolagens de dados integrados ao Supabase com eventos Socket.IO em tempo real.
- Presença atualizada a cada 20 segundos e armazenada na tabela `presence`.

## Testes manuais sugeridos

1. Criar usuário via Magic Link e verificar o e-mail no cabeçalho após login.
2. Criar sala, abrir em outro navegador/usuário e trocar mensagens (persistência + eventos `message:new`).
3. Executar rolagens (`/roll` ou formulários) e conferir o histórico e broadcast `roll:new`.
4. Validar presença ao entrar/sair e após heartbeat de 20 segundos.
5. Confirmar que usuários sem vínculo com a sala não conseguem acessar mensagens/rolagens.
