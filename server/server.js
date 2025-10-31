import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import crypto from 'crypto';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  },
  maxHttpBufferSize: 16 * 1024
});

const PORT = process.env.PORT || 3000;

app.use(express.static('public', {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

/**
 * Room schema: {
 *  id, name, description, isPrivate, password, ownerId,
 *  createdAt, members: Map<socketId, member>, bans:Set<fingerprint>,
 *  channels: Map<channelId, channelMeta>, history: Map<channelId, message[]>,
 *  voice: Set<socketId>
 * }
 */
const rooms = new Map();
const members = new Map(); // socketId -> { roomId, role, nickname, avatar }

const MAX_MEMBERS = 10;
const MAX_HISTORY = 200;
const RATE_LIMIT_WINDOW = 10_000;
const RATE_LIMIT_COUNT = 10;

const rateLimiters = new Map(); // socketId -> timestamps[]

const DEFAULT_CHANNELS = [
  { id: 'general', name: 'Geral', visibility: 'all' },
  { id: 'gm', name: 'Mestre', visibility: 'gm' }
];

function sanitizeText(input = '') {
  return String(input)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 2000);
}

function shortId() {
  return crypto.randomBytes(4).toString('hex');
}

function ensureRateLimit(socket) {
  const now = Date.now();
  const list = rateLimiters.get(socket.id) || [];
  const filtered = list.filter((ts) => now - ts < RATE_LIMIT_WINDOW);
  filtered.push(now);
  rateLimiters.set(socket.id, filtered);
  return filtered.length <= RATE_LIMIT_COUNT;
}

function ensureRoomCapacity(room) {
  return room.members.size < MAX_MEMBERS;
}

function pushHistory(room, channelId, payload) {
  const list = room.history.get(channelId) || [];
  list.push(payload);
  if (list.length > MAX_HISTORY) {
    list.splice(0, list.length - MAX_HISTORY);
  }
  room.history.set(channelId, list);
}

function serializeRoom(room) {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    isPrivate: room.isPrivate,
    createdAt: room.createdAt,
    population: room.members.size
  };
}

function getAudienceForChannel(room, channelId) {
  if (channelId === 'gm') {
    return Array.from(room.members.entries()).filter(([, m]) => m.role === 'GM' || m.role === 'CO_GM').map(([socketId]) => socketId);
  }
  return Array.from(room.members.keys());
}

function broadcastPresence(room) {
  const payload = Array.from(room.members.entries()).map(([socketId, meta]) => ({
    socketId,
    userId: meta.userId,
    nickname: meta.nickname,
    avatar: meta.avatar,
    role: meta.role,
    status: meta.status || 'online',
    muted: Boolean(meta.muted)
  }));
  io.to(`room:${room.id}`).emit('presence:update', payload);
}

function broadcastRoomList() {
  const list = Array.from(rooms.values()).map(serializeRoom);
  io.emit('rooms:list', list);
}

function leaveRoom(socket, reason = 'leave') {
  if (!socket) return;
  const member = members.get(socket.id);
  if (!member) return;
  const room = rooms.get(member.roomId);
  if (!room) {
    members.delete(socket.id);
    return;
  }
  room.members.delete(socket.id);
  room.voice.delete(socket.id);
  members.delete(socket.id);
  socket.leave(`room:${room.id}`);
  pushHistory(room, 'general', {
    type: 'system',
    message: `${member.nickname} saiu (${reason}).`,
    timestamp: Date.now()
  });
  io.to(`room:${room.id}`).emit('voice:peer-left', { socketId: socket.id });
  broadcastPresence(room);
  if (room.members.size === 0) {
    rooms.delete(room.id);
  }
  broadcastRoomList();
}

function parseDiceExpression(rawExpression) {
  const trimmed = rawExpression.trim();
  const result = {
    rolls: [],
    total: 0,
    detail: [],
    label: '',
    adv: false,
    dis: false
  };
  if (!trimmed) return result;

  const labelIndex = trimmed.indexOf('#');
  let expression = trimmed;
  if (labelIndex !== -1) {
    result.label = sanitizeText(trimmed.slice(labelIndex + 1).trim()).slice(0, 60);
    expression = trimmed.slice(0, labelIndex).trim();
  }

  const tokens = expression.split(/\s+/).filter(Boolean);
  const advIndex = tokens.findIndex((t) => t.toLowerCase() === 'adv' || t.toLowerCase() === 'dis');
  if (advIndex !== -1) {
    const mod = tokens.splice(advIndex, 1)[0].toLowerCase();
    if (mod === 'adv') result.adv = true;
    if (mod === 'dis') result.dis = true;
  }

  const joined = tokens.join('');
  if (!joined) return result;

  const termPattern = /([+-]?[^+-]+)/g;
  const terms = joined.match(termPattern) || [];

  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const body = term.replace(/^[+-]/, '');
    const diceMatch = body.match(/^(\d*)d(\d+)(!?)(?:(kh|kl)(\d+))?$/i);
    if (diceMatch) {
      let [, countStr, sidesStr, explodeFlag, keepType, keepCountStr] = diceMatch;
      let count = countStr ? parseInt(countStr, 10) : 1;
      const sides = parseInt(sidesStr, 10);
      if (!Number.isFinite(count) || count < 1 || count > 100 || !Number.isFinite(sides) || sides < 2 || sides > 1000) {
        throw new Error('Invalid dice term');
      }
      if (result.adv || result.dis) {
        if (count === 1 && sides === 20) {
          count = 2;
          keepType = result.adv ? 'kh' : 'kl';
          keepCountStr = '1';
        }
      }
      const keepCount = keepCountStr ? parseInt(keepCountStr, 10) : count;
      const rolls = [];
      for (let i = 0; i < count; i += 1) {
        let roll = 0;
        let explode = true;
        while (explode) {
          roll = Math.ceil(Math.random() * sides);
          rolls.push(roll);
          explode = explodeFlag === '!' && roll === sides && rolls.length < 100;
        }
      }
      const sorted = [...rolls].sort((a, b) => keepType === 'kl' ? a - b : b - a);
      const kept = sorted.slice(0, keepCount);
      const sum = kept.reduce((acc, val) => acc + val, 0) * sign;
      result.detail.push({ term: `${sign === -1 ? '-' : ''}${body}`, rolls, kept, sum });
      result.total += sum;
      result.rolls.push(...rolls.map((r) => r * sign));
    } else {
      const num = Number(body);
      if (!Number.isFinite(num)) {
        throw new Error('Invalid modifier');
      }
      result.detail.push({ term: `${sign === -1 ? '-' : ''}${Math.abs(num)}`, sum: num * sign });
      result.total += num * sign;
    }
  }
  return result;
}

io.on('connection', (socket) => {
  socket.data.profile = {
    nickname: `Convidado-${socket.id.slice(0, 4)}`,
    avatar: '',
    theme: 'light'
  };

  socket.on('identity:set', (profile = {}) => {
    socket.data.profile = {
      nickname: sanitizeText(profile.nickname || '').slice(0, 30) || socket.data.profile.nickname,
      avatar: sanitizeText(profile.avatar || '').slice(0, 200),
      theme: profile.theme === 'dark' ? 'dark' : 'light'
    };
  });

  socket.on('rooms:fetch', () => {
    broadcastRoomList();
  });

  socket.on('room:create', (payload = {}, callback = () => {}) => {
    try {
      const name = sanitizeText(payload.name || '').slice(0, 50);
      const description = sanitizeText(payload.description || '').slice(0, 200);
      const isPrivate = Boolean(payload.isPrivate);
      if (!name) throw new Error('Nome obrigatório');
      const roomId = shortId();
      const ownerId = socket.id;
      const room = {
        id: roomId,
        name,
        description,
        isPrivate,
        password: isPrivate ? sanitizeText(payload.password || '').slice(0, 100) : '',
        ownerId,
        createdAt: Date.now(),
        members: new Map(),
        bans: new Set(),
        channels: new Map(DEFAULT_CHANNELS.map((c) => [c.id, { ...c }])),
        history: new Map(DEFAULT_CHANNELS.map((c) => [c.id, []])),
        voice: new Set()
      };
      rooms.set(roomId, room);
      broadcastRoomList();
      callback({ ok: true, roomId });
    } catch (error) {
      callback({ ok: false, message: error.message });
    }
  });

  socket.on('room:join', (payload = {}, callback = () => {}) => {
    try {
      const { roomId, password } = payload;
      const room = rooms.get(roomId);
      if (!room) throw new Error('Sala não encontrada');
      if (room.bans.has(socket.id)) throw new Error('Você foi banido desta sala');
      if (room.isPrivate && room.password && room.password !== sanitizeText(password || '')) {
        throw new Error('Senha incorreta');
      }
      if (!ensureRoomCapacity(room)) {
        throw new Error('Sala cheia (limite de 10 jogadores).');
      }
      socket.join(`room:${roomId}`);
      const profile = socket.data.profile;
      const role = room.ownerId === socket.id ? 'GM' : 'PLAYER';
      const member = {
        socketId: socket.id,
        userId: socket.id,
        role,
        nickname: profile.nickname,
        avatar: profile.avatar,
        status: 'online'
      };
      room.members.set(socket.id, member);
      members.set(socket.id, { roomId, role, nickname: profile.nickname, avatar: profile.avatar });
      pushHistory(room, 'general', {
        type: 'system',
        message: `${profile.nickname} entrou na sala.`,
        timestamp: Date.now()
      });
      broadcastPresence(room);
      broadcastRoomList();
      const history = Array.from(room.history.entries()).map(([channelId, msgs]) => ({ channelId, messages: msgs }));
      callback({
        ok: true,
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          channels: Array.from(room.channels.values()),
          role,
          history
        }
      });
    } catch (error) {
      callback({ ok: false, message: error.message });
    }
  });

  socket.on('room:leave', () => {
    leaveRoom(socket, 'leave');
  });

  socket.on('chat:message', (payload = {}, callback = () => {}) => {
    try {
      const member = members.get(socket.id);
      if (!member) throw new Error('Não está em uma sala');
      const room = rooms.get(member.roomId);
      if (!room) throw new Error('Sala inexistente');
      if (!ensureRateLimit(socket)) {
        throw new Error('Muitas mensagens, tente novamente em instantes');
      }
      const channelId = sanitizeText(payload.channelId || 'general').slice(0, 30);
      const message = sanitizeText(payload.message || '');
      if (!message) throw new Error('Mensagem vazia');
      const whisperTo = payload.whisperTo ? sanitizeText(payload.whisperTo).slice(0, 60) : null;

      const meta = room.members.get(socket.id);
      if (!meta) throw new Error('Participante inválido');
      if (meta.muted) throw new Error('Você está silenciado');

      const event = {
        id: shortId(),
        type: whisperTo ? 'whisper' : channelId === 'gm' ? 'gm' : 'chat',
        channelId,
        whisperTo,
        author: {
          socketId: socket.id,
          nickname: meta.nickname,
          role: meta.role,
          avatar: meta.avatar
        },
        message,
        timestamp: Date.now()
      };

      if (whisperTo) {
        const targetEntry = Array.from(room.members.entries()).find(([, m]) => m.nickname === whisperTo);
        if (!targetEntry) throw new Error('Usuário não encontrado');
        const [targetSocketId] = targetEntry;
        io.to(targetSocketId).emit('chat:message', event);
        socket.emit('chat:message', event);
      } else {
        const audience = getAudienceForChannel(room, channelId);
        for (const socketId of audience) {
          io.to(socketId).emit('chat:message', event);
        }
        pushHistory(room, channelId, event);
      }
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, message: error.message });
    }
  });

  socket.on('chat:channel', (payload = {}, callback = () => {}) => {
    try {
      const member = members.get(socket.id);
      if (!member) throw new Error('Não está em uma sala');
      const room = rooms.get(member.roomId);
      if (!room) throw new Error('Sala inexistente');
      if (member.role === 'PLAYER') throw new Error('Apenas GM/Co-GM podem criar canais');
      const name = sanitizeText(payload.name || '').slice(0, 30);
      if (!name) throw new Error('Nome inválido');
      const channelId = `ch-${shortId()}`;
      const channel = { id: channelId, name, visibility: 'all' };
      room.channels.set(channelId, channel);
      room.history.set(channelId, []);
      const channels = Array.from(room.channels.values());
      callback({ ok: true, channels });
      io.to(`room:${room.id}`).emit('chat:channels', channels);
    } catch (error) {
      callback({ ok: false, message: error.message });
    }
  });

  socket.on('chat:delete', (payload = {}, callback = () => {}) => {
    try {
      const member = members.get(socket.id);
      if (!member) throw new Error('Não está em uma sala');
      const room = rooms.get(member.roomId);
      if (!room) throw new Error('Sala inexistente');
      const { messageId, channelId } = payload;
      if (!messageId) throw new Error('Mensagem inválida');
      const history = room.history.get(channelId) || [];
      const entry = history.find((m) => m.id === messageId);
      if (!entry) throw new Error('Mensagem não encontrada');
      if (entry.author.socketId !== socket.id && member.role === 'PLAYER') {
        throw new Error('Sem permissão');
      }
      entry.deleted = true;
      entry.message = '[mensagem removida]';
      io.to(`room:${room.id}`).emit('chat:delete', { messageId, channelId });
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, message: error.message });
    }
  });

  socket.on('roll:execute', (payload = {}, callback = () => {}) => {
    try {
      const member = members.get(socket.id);
      if (!member) throw new Error('Não está em uma sala');
      const room = rooms.get(member.roomId);
      if (!room) throw new Error('Sala inexistente');
      const expression = sanitizeText(payload.expression || '').slice(0, 100);
      if (!expression) throw new Error('Expressão vazia');
      const outcome = parseDiceExpression(expression);
      const event = {
        id: shortId(),
        type: 'roll',
        author: {
          socketId: socket.id,
          nickname: member.nickname,
          role: member.role,
          avatar: member.avatar
        },
        expression,
        outcome,
        timestamp: Date.now()
      };
      pushHistory(room, 'general', event);
      io.to(`room:${room.id}`).emit('roll:result', event);
      callback({ ok: true, outcome });
    } catch (error) {
      callback({ ok: false, message: error.message });
    }
  });

  socket.on('sheet:update', (payload = {}) => {
    const member = members.get(socket.id);
    if (!member) return;
    const room = rooms.get(member.roomId);
    if (!room) return;
    const sheet = payload.sheet || {};
    const sanitized = JSON.parse(JSON.stringify(sheet, (key, value) => {
      if (typeof value === 'string') return sanitizeText(value).slice(0, 500);
      return value;
    }));
    io.to(`room:${room.id}`).emit('sheet:update', {
      socketId: socket.id,
      sheet: sanitized,
      updatedAt: Date.now()
    });
  });

  socket.on('presence:update', (payload = {}) => {
    const member = members.get(socket.id);
    if (!member) return;
    const room = rooms.get(member.roomId);
    if (!room) return;
    const meta = room.members.get(socket.id);
    if (!meta) return;
    meta.status = sanitizeText(payload.status || 'online').slice(0, 20);
    broadcastPresence(room);
  });

  socket.on('moderation:action', (payload = {}, callback = () => {}) => {
    try {
      const member = members.get(socket.id);
      if (!member) throw new Error('Não está em sala');
      const room = rooms.get(member.roomId);
      if (!room) throw new Error('Sala inexistente');
      if (member.role === 'PLAYER') throw new Error('Sem permissão');
      const targetId = payload.targetId;
      const target = room.members.get(targetId);
      if (!target) throw new Error('Participante não encontrado');
      switch (payload.action) {
        case 'mute':
          target.muted = true;
          break;
        case 'unmute':
          target.muted = false;
          break;
        case 'ban':
          room.bans.add(targetId);
          const targetSocket = io.sockets.sockets.get(targetId);
          leaveRoom(targetSocket, 'ban');
          break;
        case 'promote':
          target.role = 'CO_GM';
          break;
        case 'demote':
          target.role = 'PLAYER';
          break;
        default:
          throw new Error('Ação inválida');
      }
      const targetMember = members.get(targetId);
      if (targetMember) targetMember.role = target.role;
      broadcastPresence(room);
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, message: error.message });
    }
  });

  socket.on('voice:join', (payload = {}, callback = () => {}) => {
    try {
      const member = members.get(socket.id);
      if (!member) throw new Error('Não está em uma sala');
      const room = rooms.get(member.roomId);
      if (!room) throw new Error('Sala inexistente');
      room.voice.add(socket.id);
      const peers = Array.from(room.voice).filter((id) => id !== socket.id);
      for (const peerId of peers) {
        io.to(peerId).emit('voice:peer-joined', { socketId: socket.id });
      }
      callback({ ok: true, peers });
    } catch (error) {
      callback({ ok: false, message: error.message });
    }
  });

  socket.on('voice:signal', (payload = {}) => {
    const member = members.get(socket.id);
    if (!member) return;
    const targetId = payload.target;
    if (!targetId) return;
    io.to(targetId).emit('voice:signal', {
      from: socket.id,
      data: payload.data
    });
  });

  socket.on('voice:leave', () => {
    const member = members.get(socket.id);
    if (!member) return;
    const room = rooms.get(member.roomId);
    if (!room) return;
    room.voice.delete(socket.id);
    io.to(`room:${room.id}`).emit('voice:peer-left', { socketId: socket.id });
  });

  socket.on('disconnect', () => {
    leaveRoom(socket, 'disconnect');
  });
});

server.listen(PORT, () => {
  console.log(`ChronicaRPG server listening on http://localhost:${PORT}`);
});
