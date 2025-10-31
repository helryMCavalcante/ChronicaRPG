# ChronicaRPG

Aplicação web para mesas de RPG com chat em tempo real, rolagem de dados e áudio entre participantes.

## Requisitos

- Node.js LTS

## Instalação

```bash
npm install
```

## Execução

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no navegador.

## Recursos principais

- Salas com até 10 jogadores, canais de chat e moderação básica.
- Rolagens de dados avançadas (explosão, vantagem/desvantagem, keep high/low).
- Voz entre participantes usando WebRTC com sinalização via Socket.IO.
- Ficha de personagem sincronizada em tempo real.
- Tema claro/escuro persistido no navegador.
