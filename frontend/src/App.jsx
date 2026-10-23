
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Swords, Shield, Coins, Users, Globe, Crown,
  Pause, Play, LogOut, MessageCircle, Zap, Heart,
  ChevronRight, Lock, Volume2, VolumeX
} from 'lucide-react';
import { api, getSavedUser, getToken, saveSession, clearSession } from './api.js';
import { createSocket } from './socket.js';
import { createWorld } from './game/World.js';
import { WEAPONS } from './game/Combat.js';

const initialGame = {
  coins: 100,
  health: 100,
  maxHealth: 100,
  damageBonus: 0,
  defense: 0,
  wallTier: 0,
  chapter: 1,
  weapon: 'fist',
  kills: 0
};

export default function App() {
  const gameContainer = useRef(null);
  const worldRef = useRef(null);
  const socketRef = useRef(null);
  const stateRef = useRef(initialGame);
  const lastAttackRef = useRef(0);
  const pausedRef = useRef(false);
  const roomRef = useRef(null);

  const [user, setUser] = useState(getSavedUser);
  const [screen, setScreen] = useState('auth');
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState('single');
  const [roomType, setRoomType] = useState('private');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [game, setGame] = useState(initialGame);
  const [paused, setPaused] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [onlinePlayers, setOnlinePlayers] = useState(1);
  const [serverList, setServerList] = useState([]);
  const [serverName, setServerName] = useState('새로운 국가');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [notice, setNotice] = useState('');

  const notify = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2500);
  }, []);

  const updateGame = useCallback((patch) => {
    setGame(previous => {
      const next = { ...previous, ...patch };
      stateRef.current = next;
      return next;
    });
  }, []);

  const authenticate = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const result = await api(
        authMode === 'login' ? '/api/auth/login' : '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ username, password })
        }
      );

      saveSession(result.token, result.user);
      setUser(result.user);
      setScreen('menu');
    } catch (err) {
      setError(err.message || '로그인에 실패했어.');
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setScreen('auth');
  };

  const fetchServers = useCallback(async () => {
    try {
      const result = await api('/api/rooms');
      setServerList(result.rooms || []);
    } catch {
      setServerList([]);
    }
  }, []);

  useEffect(() => {
    if (user) fetchServers();
  }, [user, fetchServers]);

  const startGame = async (selectedMode) => {
    if (selectedMode !== 'single' && !getToken()) {
      notify('온라인 플레이는 로그인해야 해.');
      return;
    }

    setMode(selectedMode);
    setGame({ ...initialGame });
    stateRef.current = { ...initialGame };
    setPaused(false);
    pausedRef.current = false;
    setMessages([]);
    setRoomId('');
    setRoomCode('');
    roomRef.current = null;

    if (selectedMode === 'single') {
      setScreen('game');
      return;
    }

    setScreen('connecting');

    try {
      const result = await api('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode: selectedMode,
          visibility: roomType,
          name: serverName
        })
      });

      setRoomId(result.room.id);
      setRoomCode(result.room.code || '');
      roomRef.current = result.room.id;
      connectSocket(result.room.id);
    } catch (err) {
      setScreen('menu');
      notify(err.message || '방을 생성하지 못했어.');
    }
  };

  const connectSocket = (id) => {
    const socket = createSocket(getToken());
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('room:join', { roomId: id }, (result) => {
        if (!result?.ok) {
          notify(result?.error || '방에 들어갈 수 없어.');
          setScreen('menu');
          socket.disconnect();
          return;
        }

        setOnlinePlayers(result.players?.length || 1);
        setRoomCode(result.code || '');
        setScreen('game');

        for (const p of result.players || []) {
          if (p.id !== socket.id) {
            worldRef.current?.addRemote(p.id, p);
          }
        }
      });
    });

    socket.on('room:state', (state) => {
      setOnlinePlayers(state.players?.length || 1);
      for (const p of state.players || []) {
        if (p.id !== socket.id) {
          worldRef.current?.updateRemote(p.id, p);
        }
      }
    });

    socket.on('player:joined', (p) => {
      worldRef.current?.addRemote(p.id, p);
      setOnlinePlayers(n => n + 1);
      notify(`${p.username || '플레이어'} 참가!`);
    });

    socket.on('player:left', (data) => {
      worldRef.current?.removeRemote(data.id);
      setOnlinePlayers(n => Math.max(1, n - 1));
    });

    socket.on('chat:message', (message) => {
      setMessages(list => [...list.slice(-99), message]);
    });

    socket.on('game:paused', (data) => {
      setPaused(Boolean(data.paused));
      pausedRef.current = Boolean(data.paused);
    });

    socket.on('game:update', (data) => {
      if (typeof data.chapter === 'number') {
        updateGame({ chapter: data.chapter });
      }
      if (typeof data.beaconHealth === 'number') {
        // 신호기 UI가 추가될 때 사용할 상태
      }
    });

    socket.on('connect_error', () => {
      notify('서버 연결에 실패했어.');
    });

    socket.connect();
  };

  useEffect(() => {
    if (screen !== 'game' || !gameContainer.current) return;

    const world = createWorld(gameContainer.current, {
      playerId: socketRef.current?.id || 'local',
      isPaused: () => pausedRef.current,
      onMove: (position) => {
        socketRef.current?.emit('player:move', position);
      }
    });

    worldRef.current = world;

    return () => {
      world.destroy();
      worldRef.current = null;
    };
  }, [screen]);

  const leaveGame = () => {
    socketRef.current?.emit('room:leave');
    socketRef.current?.disconnect();
    socketRef.current = null;
    roomRef.current = null;
    setPaused(false);
    pausedRef.current = false;
    setScreen('menu');
  };

  const togglePause = () => {
    if (mode === 'single') {
      const next = !pausedRef.current;
      pausedRef.current = next;
      setPaused(next);
      return;
    }

    socketRef.current?.emit('game:pause', { paused: !pausedRef.current }, (result) => {
      if (!result?.ok) notify(result?.error || '일시정지할 수 없어.');
    });
  };

  const attack = () => {
    if (pausedRef.current) return;

    const current = stateRef.current;
    const weapon = WEAPONS[current.weapon] || WEAPONS.fist;
    const now = Date.now();

    if (now - lastAttackRef.current < weapon.cooldown) return;
    lastAttackRef.current = now;

    socketRef.current?.emit('combat:attack', {
      weaponId: weapon.id
    }, (result) => {
      if (!result?.ok) {
        notify(result?.error || '공격에 실패했어.');
        return;
      }

      if (typeof result.coins === 'number') updateGame({ coins: result.coins });
      if (typeof result.kills === 'number') updateGame({ kills: result.kills });
      if (result.message) notify(result.message);
    });

    // 싱글플레이 테스트용 타격 동작
    if (mode === 'single') {
      notify(`${weapon.name} 공격!`);
    }
  };

  useEffect(() => {
    if (screen !== 'game') return;

    const onKey = (event) => {
      if (event.code === 'KeyF') attack();
      if (event.code === 'Escape') togglePause();
      if (event.code === 'KeyE') setShopOpen(value => !value);
      if (event.code === 'Enter') setChatOpen(value => !value);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const purchase = (item) => {
    const current = stateRef.current;

    if (item.type === 'weapon') {
      const weapon = WEAPONS[item.id];
      if (!weapon) return;
      if (current.weapon === item.id) {
        notify('이미 장착한 무기야.');
        return;
      }
      if (current.coins < weapon.cost) {
        notify('코인이 부족해!');
        return;
      }

      if (mode === 'single') {
        updateGame({
          coins: current.coins - weapon.cost,
          weapon: item.id
        });
        notify(`${weapon.name} 구매 완료!`);
      } else {
        socketRef.current?.emit('shop:buy', { itemId: item.id }, (result) => {
          if (!result?.ok) return notify(result?.error || '구매 실패');
          updateGame(result.game);
          notify('구매 완료!');
        });
      }
      return;
    }

    if (item.type === 'health') {
      if (current.coins < 30) return notify('코인이 부족해!');
      if (mode !== 'single') {
        socketRef.current?.emit('shop:buy', { itemId: 'health' }, (result) => {
          if (!result?.ok) return notify(result?.error || '구매 실패');
          updateGame(result.game);
        });
      } else {
        updateGame({
          coins: current.coins - 30,
          maxHealth: current.maxHealth + 20,
          health: current.health + 20
        });
      }
      return;
    }

    if (item.type === 'wall') {
      const cost = 80 * (current.wallTier + 1);
      if (current.coins < cost) return notify('코인이 부족해!');
      if (current.wallTier >= 5) return notify('성벽 최대 레벨이야!');

      if (mode !== 'single') {
        socketRef.current?.emit('shop:buy', { itemId: 'wall' }, (result) => {
          if (!result?.ok) return notify(result?.error || '업그레이드 실패');
          updateGame(result.game);
          worldRef.current?.setWallTier(result.game.wallTier);
        });
      } else {
        const wallTier = current.wallTier + 1;
        updateGame({ coins: current.coins - cost, wallTier });
        worldRef.current?.setWallTier(wallTier);
      }
    }

    if (item.type === 'damage') {
      if (current.coins < 60) return notify('코인이 부족해!');
      if (mode !== 'single') {
        socketRef.current?.emit('shop:buy', { itemId: 'damage' }, (result) => {
          if (!result?.ok) return notify(result?.error || '업그레이드 실패');
          updateGame(result.game);
        });
      } else {
        updateGame({
          coins: current.coins - 60,
          damageBonus: current.damageBonus + 5
        });
      }
    }
  };

  const sendChat = (event) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    if (mode === 'single') {
      setMessages(list => [...list, {
        username: user?.username || '플레이어',
        text,
        time: new Date().toLocaleTimeString()
      }]);
    } else {
      socketRef.current?.emit('chat:send', { text }, (result) => {
        if (!result?.ok) notify(result?.error || '채팅 전송 실패');
      });
    }

    setChatInput('');
  };

  const createServer = () => {
    setMode('server');
    startGame('server');
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      notify('서버 키를 복사했어!');
    } catch {
      notify(`서버 키: ${roomCode}`);
    }
  };

  const activateVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setVoiceEnabled(true);
      notify('마이크 권한을 확인했어. 음성 전송 기능은 아직 연결 단계야.');
    } catch {
      notify('마이크 권한을 허용해야 해.');
    }
  };

  if (screen === 'auth') {
    return (
      <main className="auth-screen">
        <div className="auth-backdrop" />
        <section className="auth-card">
          <div className="brand-mark">M</div>
          <p className="eyebrow">BUILD · CONQUER · RULE</p>
          <h1>MARST <span>WORLD</span></h1>
          <p className="muted">문명을 세우고, 세계를 지배해.</p>

          <form onSubmit={authenticate} className="auth-form">
            <label>닉네임</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              minLength={2}
              maxLength={20}
              autoComplete="username"
              required
              placeholder="닉네임 입력"
            />

            <label>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              maxLength={128}
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              required
              placeholder="8자 이상"
            />

            {error && <p className="error-message">{error}</p>}

            <button className="primary-button full-button" disabled={busy}>
              {busy ? '처리 중...' : authMode === 'login' ? '로그인' : '회원가입'}
              <ChevronRight size={18} />
            </button>
          </form>

          <button
            className="text-button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {authMode === 'login'
              ? '계정이 없어? 회원가입'
              : '이미 계정이 있어? 로그인'}
          </button>
        </section>
      </main>
    );
  }

  if (screen === 'connecting') {
    return (
      <main className="connecting-screen">
        <div className="loader-ring" />
        <h2>월드에 연결하는 중...</h2>
        <p>서버 상태와 플레이어 정보를 확인하고 있어.</p>
        <button className="secondary-button" onClick={() => setScreen('menu')}>
          취소
        </button>
      </main>
    );
  }

  if (screen === 'menu') {
    return (
      <main className="menu-screen">
        <header className="topbar">
          <a className="brand" href="#" onClick={e => e.preventDefault()}>
            <span className="brand-mark small">M</span>
            <span>MARST <b>WORLD</b></span>
          </a>
          <div className="user-chip">
            <span className="online-dot" />
            {user?.username}
            <button className="icon-button" onClick={logout} title="로그아웃">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">YOUR EMPIRE STARTS HERE</p>
            <h1>세계를 건설하고<br /><span>지배하라.</span></h1>
            <p className="hero-description">
              신호기를 지키고, 무기를 얻고, 성벽을 강화해.
              혼자서 살아남거나 다른 플레이어와 국가를 이루어 세계를 차지해.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => startGame('single')}>
                <Play size={18} /> 싱글플레이
              </button>
              <button className="secondary-button" onClick={() => {
                setMode('multiplayer');
                setScreen('multiplayer');
              }}>
                <Users size={18} /> 멀티플레이
              </button>
            </div>
          </div>
          <div className="hero-symbol">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="pyramid-symbol">△</div>
            <div className="hero-glow" />
          </div>
        </section>

        <section className="mode-grid">
          <button className="mode-card" onClick={() => startGame('single')}>
            <div className="mode-icon teal"><Swords /></div>
            <div>
              <h3>싱글플레이</h3>
              <p>혼자 시작하는 생존과 성장</p>
            </div>
            <ChevronRight />
          </button>

          <button className="mode-card" onClick={() => setScreen('multiplayer')}>
            <div className="mode-icon purple"><Users /></div>
            <div>
              <h3>멀티플레이</h3>
              <p>2~4명의 플레이어가 함께하는 국가 경쟁</p>
            </div>
            <ChevronRight />
          </button>

          <button className="mode-card" onClick={() => setScreen('servers')}>
            <div className="mode-icon gold"><Globe /></div>
            <div>
              <h3>서버 탐색</h3>
              <p>공개 서버에 참가하거나 새 서버 만들기</p>
            </div>
            <ChevronRight />
          </button>
        </section>

        <footer className="menu-footer">
          <span>MARST WORLD · EARLY DEVELOPMENT</span>
          <span>ACCOUNT: {user?.username}</span>
        </footer>
      </main>
    );
  }

  if (screen === 'multiplayer') {
    return (
      <main className="sub-screen">
        <header className="topbar">
          <button className="text-button" onClick={() => setScreen('menu')}>← 메인 메뉴</button>
          <span className="brand">MARST <b>WORLD</b></span>
        </header>

        <section className="setup-card">
          <p className="eyebrow">MULTIPLAYER SETUP</p>
          <h1>함께 세계를 정복해.</h1>
          <p className="muted">2~4명이 같은 월드에서 경쟁하고 협력해.</p>

          <label>국가 이름</label>
          <input
            value={serverName}
            onChange={e => setServerName(e.target.value)}
            maxLength={30}
            placeholder="국가 이름"
          />

          <label>서버 공개 범위</label>
          <div className="choice-row">
            <button
              className={roomType === 'public' ? 'choice active' : 'choice'}
              onClick={() => setRoomType('public')}
            >
              <Globe /> 공개 서버
            </button>
            <button
              className={roomType === 'private' ? 'choice active' : 'choice'}
              onClick={() => setRoomType('private')}
            >
              <Lock /> 비공개 서버
            </button>
          </div>

          <button className="primary-button full-button" onClick={() => startGame('multiplayer')}>
            <Users /> 멀티플레이 방 만들기
          </button>
          <button className="secondary-button full-button" onClick={() => setScreen('servers')}>
            서버 목록 보기
          </button>
        </section>
      </main>
    );
  }

  if (screen === 'servers') {
    return (
      <main className="sub-screen">
        <header className="topbar">
          <button className="text-button" onClick={() => setScreen('menu')}>← 메인 메뉴</button>
          <button className="secondary-button" onClick={fetchServers}>새로고침</button>
        </header>

        <section className="server-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">WORLD BROWSER</p>
              <h1>서버 탐색</h1>
            </div>
            <button className="primary-button" onClick={() => setScreen('multiplayer')}>
              + 서버 만들기
            </button>
          </div>

          <div className="server-list">
            {serverList.length === 0 && (
              <div className="empty-state">
                <Globe size={32} />
                <h3>현재 표시할 서버가 없어.</h3>
                <p>새 서버를 만들거나 잠시 후 다시 확인해.</p>
              </div>
            )}

            {serverList.map(server => (
              <article className="server-row" key={server.id}>
                <div className="server-emblem"><Crown /></div>
                <div className="server-info">
                  <h3>{server.name}</h3>
                  <p>{server.visibility === 'public' ? '공개 서버' : '비공개 서버'} · {server.mode}</p>
                </div>
                <span className="player-count">
                  <Users size={15} /> {server.players}/{server.maxPlayers ?? '∞'}
                </span>
                <button
                  className="secondary-button"
                  disabled={server.visibility !== 'public' || server.players >= (server.maxPlayers ?? 100)}
                  onClick={async () => {
                    try {
                      const result = await api(`/api/rooms/${server.id}/join`, {
                        method: 'POST'
                      });
                      setMode('server');
                      setRoomId(result.room.id);
                      setRoomCode(result.room.code || '');
                      roomRef.current = result.room.id;
                      setScreen('connecting');
                      connectSocket(result.room.id);
                    } catch (err) {
                      notify(err.message);
                    }
                  }}
                >
                  참가
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="game-screen">
      <div className="game-canvas" ref={gameContainer} />

      <header className="game-topbar">
        <div className="game-brand">
          <span className="brand-mark tiny">M</span>
          <div>
            <strong>MARST WORLD</strong>
            <small>CHAPTER {game.chapter}</small>
          </div>
        </div>

        <div className="game-stats">
          <div className="stat-pill"><Coins size={16} /> {game.coins}</div>
          <div className="stat-pill"><Users size={16} /> {mode === 'single' ? 1 : onlinePlayers}</div>
          {mode !== 'single' && roomCode && (
            <button className="stat-pill code-pill" onClick={copyRoomCode}>
              <Lock size={14} /> {roomCode}
            </button>
          )}
          <button className="icon-button glass" onClick={togglePause} title="일시정지">
            {paused ? <Play /> : <Pause />}
          </button>
          <button className="icon-button glass" onClick={leaveGame} title="나가기">
            <LogOut />
          </button>
        </div>
      </header>

      <aside className="health-panel glass">
        <div className="health-title"><Heart size={16} /> 체력</div>
        <div className="health-track">
          <div className="health-fill" style={{
            width: `${Math.max(0, Math.min(100, game.health / game.maxHealth * 100))}%`
          }} />
        </div>
        <small>{game.health} / {game.maxHealth}</small>
        <div className="health-title second"><Shield size={15} /> 성벽 레벨 {game.wallTier}</div>
        <div className="health-title"><Swords size={15} /> 처치 {game.kills}</div>
      </aside>

      <div className="beacon-label glass">
        <Zap size={17} />
        <div><strong>중앙 신호기</strong><small>무기 · 강화 · 국가 관리</small></div>
        <button className="icon-button" onClick={() => setShopOpen(!shopOpen)}>
          <ChevronRight />
        </button>
      </div>

      <div className="game-controls glass">
        <span>WASD 이동</span>
        <span>SPACE 점프</span>
        <span>F 공격</span>
        <span>E 상점</span>
        <span>ENTER 채팅</span>
      </div>

      <div className="game-actions">
        <button className="action-button attack-button" onClick={attack}>
          <Swords size={22} /><span>공격</span>
        </button>
        <button className="action-button" onClick={() => setShopOpen(!shopOpen)}>
          <Coins size={22} /><span>상점</span>
        </button>
        <button className="action-button" onClick={() => setChatOpen(!chatOpen)}>
          <MessageCircle size={22} /><span>채팅</span>
        </button>
        <button className="action-button" onClick={activateVoice}>
          {voiceEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
          <span>음성</span>
        </button>
      </div>

      {shopOpen && (
        <section className="shop-panel glass">
          <div className="panel-heading">
            <div><p className="eyebrow">BEACON MARKET</p><h2>신호기 상점</h2></div>
            <button className="icon-button" onClick={() => setShopOpen(false)}>×</button>
          </div>
          <div className="shop-balance"><Coins size={16} /> 보유 코인 <strong>{game.coins}</strong></div>

          {Object.values(WEAPONS).map(weapon => (
            <div className="shop-item" key={weapon.id}>
              <div className="shop-item-icon"><Swords /></div>
              <div className="shop-item-info">
                <strong>{weapon.name}</strong>
                <small>공격력 {weapon.damage + game.damageBonus} · 사거리 {weapon.range}</small>
              </div>
              <button
                className="buy-button"
                disabled={game.weapon === weapon.id}
                onClick={() => purchase({ type: 'weapon', id: weapon.id })}
              >
                {game.weapon === weapon.id ? '장착 중' : `${weapon.cost} C`}
              </button>
            </div>
          ))}

          <div className="shop-item">
            <div className="shop-item-icon"><Heart /></div>
            <div className="shop-item-info"><strong>체력 증강</strong><small>최대 체력 +20</small></div>
            <button className="buy-button" onClick={() => purchase({ type: 'health' })}>30 C</button>
          </div>

          <div className="shop-item">
            <div className="shop-item-icon"><Zap /></div>
            <div className="shop-item-info"><strong>공격력 강화</strong><small>공격력 +5</small></div>
            <button className="buy-button" onClick={() => purchase({ type: 'damage' })}>60 C</button>
          </div>

          <div className="shop-item">
            <div className="shop-item-icon"><Shield /></div>
            <div className="shop-item-info"><strong>성벽 강화</strong><small>현재 레벨 {game.wallTier}/5</small></div>
            <button className="buy-button" onClick={() => purchase({ type: 'wall' })}>
              {80 * (game.wallTier + 1)} C
            </button>
          </div>
        </section>
      )}

      {chatOpen && (
        <section className="chat-panel glass">
          <div className="panel-heading">
            <h3><MessageCircle size={17} /> 월드 채팅</h3>
            <button className="icon-button" onClick={() => setChatOpen(false)}>×</button>
          </div>
          <div className="chat-messages">
            {messages.map((message, index) => (
              <div className="chat-message" key={`${message.time}-${index}`}>
                <strong>{message.username}</strong>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={sendChat} className="chat-form">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              maxLength={250}
              placeholder="메시지 입력..."
            />
            <button className="primary-button">전송</button>
          </form>
        </section>
      )}

      {paused && (
        <div className="pause-overlay">
          <div className="pause-card">
            <Pause size={36} />
            <p className="eyebrow">GAME PAUSED</p>
            <h2>일시정지</h2>
            <p>{mode === 'single'
              ? '계속하기를 누르면 게임이 재개돼.'
              : '방장이 정지한 경우 모든 플레이어가 멈춰.'}</p>
            <button className="primary-button full-button" onClick={togglePause}>
              <Play size={18} /> 계속하기
            </button>
            <button className="secondary-button full-button" onClick={leaveGame}>게임 나가기</button>
          </div>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}
