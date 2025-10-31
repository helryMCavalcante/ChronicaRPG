import http from 'http';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { requireAuth } from './middleware/requireAuth.js';
import { getUserFromToken } from './supabase.js';
import { createRoomsRouter } from './routes/rooms.js';
import { createMessagesRouter } from './routes/messages.js';
import { createRollsRouter } from './routes/rolls.js';
import { createPresenceRouter } from './routes/presence.js';
import { ensureRoomMember } from './utils/rooms.js';

const PORT = process.env.PORT || 3000;
const corsOrigin = (process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin.length ? corsOrigin : true
  }
});

app.use(cors({
  origin: corsOrigin.length ? corsOrigin : true
}));
app.use(express.json());

const messageLimiter = rateLimit({
  windowMs: 60_000,
  max: 60
});
const rollLimiter = rateLimit({
  windowMs: 60_000,
  max: 30
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/rooms', requireAuth, createRoomsRouter(io));
app.use('/messages', requireAuth, messageLimiter, createMessagesRouter(io));
app.use('/rolls', requireAuth, rollLimiter, createRollsRouter(io));
app.use('/presence', requireAuth, createPresenceRouter(io));

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Token ausente'));
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return next(new Error('Token inválido'));
    }
    socket.data.user = {
      id: user.id,
      email: user.email
    };
    return next();
  } catch (error) {
    return next(error);
  }
});

io.on('connection', (socket) => {
  socket.on('room:subscribe', async (roomId, callback = () => {}) => {
    try {
      if (!roomId) throw new Error('roomId obrigatório');
      await ensureRoomMember(roomId, socket.data.user.id);
      await socket.join(`room:${roomId}`);
      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: error.message });
    }
  });

  socket.on('room:unsubscribe', async (roomId) => {
    if (!roomId) return;
    await socket.leave(`room:${roomId}`);
  });
});

server.listen(PORT, () => {
  console.log(`ChronicaRPG API listening on port ${PORT}`);
});
