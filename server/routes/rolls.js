import { Router } from 'express';
import { supabase } from '../supabase.js';
import { ensureRoomMember } from '../utils/rooms.js';
import { rollDice } from '../utils/dice.js';

const ACCESS_ERROR = 'Acesso negado à sala';

export function createRollsRouter(io) {
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
        .from('rolls')
        .select('id, formula, result, created_at, user_id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) {
        throw new Error(error.message);
      }
      res.json({
        rolls: data || []
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
      const formula = String(req.body?.formula || '').trim();
      await ensureRoomMember(roomId, req.user.id);
      const result = rollDice(formula);
      const { data, error } = await supabase
        .from('rolls')
        .insert({
          room_id: roomId,
          user_id: req.user.id,
          formula: result.formula,
          result
        })
        .select('id, formula, result, created_at')
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const payload = {
        id: data.id,
        room_id: roomId,
        formula: data.formula,
        result: data.result,
        created_at: data.created_at,
        user: {
          id: req.user.id,
          email: req.user.email
        }
      };
      io.to(`room:${roomId}`).emit('roll:new', payload);
      res.status(201).json({ roll: payload });
    } catch (error) {
      const status = error.message === ACCESS_ERROR ? 403 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  return router;
}
