
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import {
  createUserId,
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  authenticateRequest
} from './auth.js';
import {
  rooms,
  socketUsers,
  createRoom,
  getRoom,
  findUserRoom,
  listPublicRooms,
  removeEmptyRoom
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  const temporary = `${USERS_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(temporary, USERS_FILE);
}

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.disable('x-powered-by');
app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '32kb' }));

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 100_000,
  connectTimeout: 10_000
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'MARST WORLD',
    activeRooms: rooms.size
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = req.body?.password;

    if (!/^[a-zA-Z0-9가-힣_-]{2,20}$/.test(username)) {
      return res.status(400).json({
        error: '닉네임은 2~20자의 한글, 영문, 숫자, _ 또는 -만 사용할 수 있습니다.'
      });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({
        error: '비밀번호는 8~128자로 설정해야 합니다.'
      });
    }

    const users = loadUsers();

    if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: '이미 사용 중인 닉네임입니다.' });
    }

    const user = {
      id: createUserId(),
      username,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    res.status(201).json({
      token: createToken(user),
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = req.body?.password;

    if (typeof password !== 'string') {
      return res.status(400).json({ error: '비밀번호를 입력하세요.' });
    }

    const user = loadUsers().find(
      item => item.username.toLowerCase() === username.toLowerCase()
    );

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: '닉네임 또는 비밀번호가 틀렸습니다.' });
    }

    res.json({
      token: createToken(user),
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

app.get('/api/me', authenticateRequest, (req, res) => {
  res.json({
    id: req.user.sub,
    username: req.user.username
  });
});

app.get('/api/rooms', authenticateRequest, (_req, res) => {
  res.json({ rooms: listPublicRooms() });
});

app.post('/api/rooms', authenticateRequest, (req, res) => {
  const mode = req.body?.mode;
  const visibility = req.body?.visibility;
  const name = String(req.body?.name || '새로운 국가').trim().slice(0, 30);

  if (!['multiplayer', 'server'].includes(mode)) {
    return res.status(400).json({ error: '지원하지 않는 게임 모드입니다.' });
  }

  if (!['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: '서버 공개 범위를 선택하세요.' });
  }

  if (findUserRoom(req.user.sub)) {
    return res.status(409).json({ error: '이미 참가 중인 서버가 있습니다.' });
  }

  const room = createRoom({
    mode,
    visibility,
    name,
    ownerId: req.user.sub,
    ownerName: req.user.username
  });

  res.status(201).json({
    room: {
      ...room.getPublicState(),
      code: room.code
    }
  });

  io.emit('rooms:changed', listPublicRooms());
});

app.post('/api/rooms/:id/join', authenticateRequest, (req, res) => {
  const room = getRoom(req.params.id);

  if (!room) {
    return res.status(404).json({ error: '서버를 찾을 수 없습니다.' });
  }

  if (room.visibility !== 'public') {
    return res.status(403).json({ error: '비공개 서버는 서버 키로 참가해야 합니다.' });
  }

  if (!room.canJoin()) {
    return res.status(409).json({ error: '서버가 가득 찼습니다.' });
  }

  if (findUserRoom(req.user.sub)) {
    return res.status(409).json({ error: '이미 참가 중인 서버가 있습니다.' });
  }

  res.json({
    room: {
      ...room.getPublicState(),
      code: ''
    }
  });
});

app.post('/api/rooms/join-by-code', authenticateRequest, (req, res) => {
  const code = String(req.body?.code || '');

  if (code.length !== 20) {
    return res.status(400).json({ error: '서버 키는 20자리여야 합니다.' });
  }

  const room = [...rooms.values()].find(item => item.code === code);

  if (!room) {
    return res.status(404).json({ error: '서버 키가 올바르지 않습니다.' });
  }

  if (!room.canJoin()) {
    return res.status(409).json({ error: '서버가 가득 찼습니다.' });
  }

  if (findUserRoom(req.user.sub)) {
    return res.status(409).json({ error: '이미 참가 중인 서버가 있습니다.' });
  }

  res.json({
    room: {
      ...room.getPublicState(),
      code: room.code
    }
  });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = typeof token === 'string' ? verifyToken(token) : null;

  if (!payload) {
    return next(new Error('로그인이 필요합니다.'));
  }

  const user = loadUsers().find(item => item.id === payload.sub);

  if (!user) {
    return next(new Error('계정을 찾을 수 없습니다.'));
  }

  socket.data.user = {
    id: user.id,
    username: user.username
  };

  next();
});

function emitRoomState(room) {
  io.to(room.id).emit('room:state', room.getState());
  io.emit('rooms:changed', listPublicRooms());
}

function leaveCurrentRoom(socket) {
  const currentRoomId = socket.data.roomId;
  if (!currentRoomId) return;

  const room = getRoom(currentRoomId);
  socket.leave(currentRoomId);
  socket.data.roomId = null;
  socketUsers.delete(socket.id);

  if (room) {
    const removed = room.removePlayer(socket.id);

    if (removed) {
      io.to(room.id).emit('player:left', {
        id: socket.id,
        username: removed.username
      });
    }

    if (room.players.size === 0) {
      removeEmptyRoom(room.id);
    } else {
      emitRoomState(room);
    }
  }
}

io.on('connection', socket => {
  const user = socket.data.user;

  socket.on('room:join', (data, ack = () => {}) => {
    try {
      if (socket.data.roomId) leaveCurrentRoom(socket);

      const room = getRoom(String(data?.roomId || ''));

      if (!room) {
        return ack({ ok: false, error: '서버가 존재하지 않습니다.' });
      }

      if (!room.canJoin()) {
        return ack({ ok: false, error: '서버가 가득 찼습니다.' });
      }

      if (findUserRoom(user.id)) {
        return ack({ ok: false, error: '이미 다른 서버에 참가 중입니다.' });
      }

      if (room.mode === 'multiplayer' && room.players.size >= 4) {
        return ack({ ok: false, error: '멀티플레이는 최대 4명입니다.' });
      }

      const player = room.addPlayer({
        socketId: socket.id,
        userId: user.id,
        username: user.username
      });

      socket.join(room.id);
      socket.data.roomId = room.id;
      socketUsers.set(socket.id, { userId: user.id, roomId: room.id });

      ack({
        ok: true,
        code: room.visibility === 'private' ? room.code : '',
        players: [...room.players.values()].map(p => room.getPlayerState(p)),
        game: room.getPlayerState(player)
      });

      socket.to(room.id).emit('player:joined', room.getPlayerState(player));
      emitRoomState(room);
    } catch (error) {
      ack({ ok: false, error: error.message || '서버 참가 실패' });
    }
  });

  socket.on('player:move', (position) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.paused) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (room.move(player, position)) {
      socket.to(room.id).volatile.emit('player:moved', {
        id: socket.id,
        x: player.x,
        y: player.y,
        z: player.z,
        rotation: player.rotation,
        health: player.health
      });
    }
  });

  socket.on('combat:attack', (data, ack = () => {}) => {
    const room = getRoom(socket.data.roomId);

    if (!room) {
      return ack({ ok: false, error: '게임 서버에 연결되지 않았습니다.' });
    }

    const player = room.players.get(socket.id);
    const result = room.attack(player, data?.weaponId);

    ack(result);

    if (result.ok && result.hit) {
      io.to(room.id).emit('combat:result', {
        attackerId: socket.id,
        target: result.target,
        damage: result.damage,
        killed: result.killed
      });
      emitRoomState(room);
    }
  });

  socket.on('shop:buy', (data, ack = () => {}) => {
    const room = getRoom(socket.data.roomId);

    if (!room) {
      return ack({ ok: false, error: '게임 서버에 연결되지 않았습니다.' });
    }

    const player = room.players.get(socket.id);
    const result = room.buy(player, data?.itemId);

    if (result.ok) {
      ack({
        ...result,
        game: result.game,
        wallTier: room.wallTier
      });
      emitRoomState(room);
    } else {
      ack(result);
    }
  });

  socket.on('game:pause', (data, ack = () => {}) => {
    const room = getRoom(socket.data.roomId);

    if (!room) {
      return ack({ ok: false, error: '게임 서버에 연결되지 않았습니다.' });
    }

    const result = room.pause(user.id, Boolean(data?.paused));
    ack(result);

    if (result.ok) {
      io.to(room.id).emit('game:paused', {
        paused: room.paused,
        by: user.username
      });
      emitRoomState(room);
    }
  });

  socket.on('chat:send', (data, ack = () => {}) => {
    const room = getRoom(socket.data.roomId);
    const player = room?.players.get(socket.id);

    if (!room || !player) {
      return ack({ ok: false, error: '먼저 서버에 참가해야 합니다.' });
    }

    const text = typeof data?.text === 'string' ? data.text.trim() : '';

    if (!text || text.length > 250) {
      return ack({ ok: false, error: '메시지는 1~250자로 입력하세요.' });
    }

    io.to(room.id).emit('chat:message', {
      username: user.username,
      text,
      time: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    });

    ack({ ok: true });
  });

  socket.on('room:leave', () => leaveCurrentRoom(socket));
  socket.on('disconnect', () => leaveCurrentRoom(socket));
});

// 챕터 진행 및 서버 상태 갱신
const chapterTimer = setInterval(() => {
  for (const room of rooms.values()) {
    const update = room.tick();

    if (update) {
      io.to(room.id).emit('game:update', update);
      emitRoomState(room);
    }
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MARST WORLD server listening on ${PORT}`);
});

function shutdown() {
  clearInterval(chapterTimer);
  io.close(() => {
    server.close(() => process.exit(0));
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
