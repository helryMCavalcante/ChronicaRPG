import { Router } from 'express';
import { supabase } from '../supabase.js';
import { addMemberToRoom, ensureRoomMember, getRoomById, listRoomsForUser, removeMemberFromRoom } from '../utils/rooms.js';

const ACCESS_ERROR = 'Acesso negado à sala';

function serializeRoom(room, role, memberCount = 0) {
  return {
    id: room.id,
    name: room.name,
    is_private: room.is_private,
    owner: room.owner,
    created_at: room.created_at,
    role,
    member_count: memberCount
  };
}

async function getMemberCount(roomId) {
  const { count, error } = await supabase
    .from('room_members')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

export function createRoomsRouter(io) {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const rooms = await listRoomsForUser(req.user.id);
      const payload = [];
      for (const room of rooms) {
        const count = await getMemberCount(room.id);
        payload.push(serializeRoom(room, room.role, count));
      }
      res.json({ rooms: payload });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim().slice(0, 80);
      if (!name) {
        return res.status(400).json({ error: 'Nome obrigatório' });
      }
      const isPrivate = Boolean(req.body?.isPrivate);
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          name,
          is_private: isPrivate,
          owner: req.user.id
        })
        .select('id, name, is_private, owner, created_at')
        .single();
      if (error) {
        throw new Error(error.message);
      }
      await addMemberToRoom(data.id, req.user.id, 'OWNER');
      const count = await getMemberCount(data.id);
      res.status(201).json({ room: serializeRoom(data, 'OWNER', count) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:roomId/join', async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const room = await getRoomById(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Sala inexistente' });
      }
      if (room.is_private && room.owner !== req.user.id) {
        const { data, error } = await supabase
          .from('room_members')
          .select('role')
          .eq('room_id', roomId)
          .eq('user_id', req.user.id)
          .maybeSingle();
        if (error) {
          throw new Error(error.message);
        }
        if (!data) {
          return res.status(403).json({ error: 'Sala privada' });
        }
      }
      await addMemberToRoom(roomId, req.user.id);
      const memberData = await ensureRoomMember(roomId, req.user.id);
      const count = await getMemberCount(roomId);
      io.to(`room:${roomId}`).emit('room:joined', {
        roomId,
        userId: req.user.id,
        email: req.user.email
      });
      res.json({ room: serializeRoom(room, memberData.role, count) });
    } catch (error) {
      const status = error.message === ACCESS_ERROR ? 403 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  router.post('/:roomId/leave', async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const room = await getRoomById(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Sala inexistente' });
      }
      await removeMemberFromRoom(roomId, req.user.id);
      io.to(`room:${roomId}`).emit('room:left', {
        roomId,
        userId: req.user.id
      });
      res.json({ ok: true });
    } catch (error) {
      const status = error.message === ACCESS_ERROR ? 403 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  return router;
}
