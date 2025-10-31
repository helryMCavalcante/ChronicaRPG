import { Router } from 'express';
import { supabase } from '../supabase.js';
import { ensureRoomMember } from '../utils/rooms.js';

const ACCESS_ERROR = 'Acesso negado à sala';

export function createPresenceRouter(io) {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const roomId = req.query.room_id;
      if (!roomId) {
        return res.status(400).json({ error: 'room_id obrigatório' });
      }
      await ensureRoomMember(roomId, req.user.id);
      const { data, error } = await supabase
        .from('presence')
        .select('user_id, last_seen')
        .eq('room_id', roomId)
        .gte('last_seen', new Date(Date.now() - 60_000).toISOString())
        .order('last_seen', { ascending: false });
      if (error) {
        throw new Error(error.message);
      }
      res.json({ presence: data || [] });
    } catch (error) {
      const status = error.message === ACCESS_ERROR ? 403 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  router.post('/heartbeat', async (req, res) => {
    try {
      const roomId = req.body?.room_id;
      if (!roomId) {
        return res.status(400).json({ error: 'room_id obrigatório' });
      }
      await ensureRoomMember(roomId, req.user.id);
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from('presence')
        .upsert({
          room_id: roomId,
          user_id: req.user.id,
          last_seen: timestamp
        }, { onConflict: 'room_id,user_id' });
      if (error) {
        throw new Error(error.message);
      }
      io.to(`room:${roomId}`).emit('presence:update', {
        roomId,
        userId: req.user.id,
        last_seen: timestamp
      });
      res.json({ ok: true });
    } catch (error) {
      const status = error.message === ACCESS_ERROR ? 403 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  return router;
}
