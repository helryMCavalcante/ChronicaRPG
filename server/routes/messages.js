import { Router } from 'express';
import { supabase } from '../supabase.js';
import { ensureRoomMember } from '../utils/rooms.js';
import { sanitizeMessage, validateMessage } from '../utils/validation.js';

const ACCESS_ERROR = 'Acesso negado à sala';

export function createMessagesRouter(io) {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const roomId = req.query.room_id;
      if (!roomId) {
        return res.status(400).json({ error: 'room_id obrigatório' });
      }
      await ensureRoomMember(roomId, req.user.id);
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, created_at, user_id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) {
        throw new Error(error.message);
      }
      res.json({
        messages: (data || []).map((row) => ({
          id: row.id,
          content: row.content,
          created_at: row.created_at,
          user_id: row.user_id
        }))
      });
    } catch (error) {
      const status = error.message === ACCESS_ERROR ? 403 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const roomId = req.body?.room_id;
      if (!roomId) {
        return res.status(400).json({ error: 'room_id obrigatório' });
      }
      const content = validateMessage(req.body?.content || '');
      await ensureRoomMember(roomId, req.user.id);
      const { data, error } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          user_id: req.user.id,
          content
        })
        .select('id, content, created_at')
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const payload = {
        id: data.id,
        room_id: roomId,
        content: sanitizeMessage(data.content),
        created_at: data.created_at,
        user: {
          id: req.user.id,
          email: req.user.email
        }
      };
      io.to(`room:${roomId}`).emit('message:new', payload);
      res.status(201).json({ message: payload });
    } catch (error) {
      const status = error.message === ACCESS_ERROR ? 403 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  return router;
}
