import { getUserFromToken } from '../supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  if (!token) {
    return res.status(401).json({ error: 'Token ausente' });
  }
  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  req.user = {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata || {}
  };
  return next();
}
