
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.');
}

export function createUserId() {
  return crypto.randomUUID();
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function createToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    secret,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload.sub !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export function authenticateRequest(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : '';

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  req.user = payload;
  next();
}
