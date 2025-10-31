import { supabase } from '../supabase.js';

export async function getRoomById(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, is_private, owner, created_at')
    .eq('id', roomId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function ensureRoomMember(roomId, userId) {
  const { data, error } = await supabase
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error('Acesso negado à sala');
  }
  return data;
}

export async function listRoomsForUser(userId) {
  const { data, error } = await supabase
    .from('room_members')
    .select('room_id, role, rooms(id, name, is_private, owner, created_at)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  const seen = new Map();
  for (const item of data || []) {
    if (!item.rooms) continue;
    const room = {
      ...item.rooms,
      role: item.role
    };
    seen.set(room.id, room);
  }
  return Array.from(seen.values());
}

export async function addMemberToRoom(roomId, userId, role = 'PLAYER') {
  const { error } = await supabase
    .from('room_members')
    .upsert({ room_id: roomId, user_id: userId, role }, { onConflict: 'room_id,user_id' });
  if (error) {
    throw new Error(error.message);
  }
}

export async function removeMemberFromRoom(roomId, userId) {
  const { error } = await supabase
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) {
    throw new Error(error.message);
  }
}
