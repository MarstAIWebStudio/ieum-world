
import * as THREE from 'three';
import { createPlayer } from './Player.js';

export function createWorld(container, callbacks = {}) {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color('#a8c5d5');
  scene.fog = new THREE.Fog('#a8c5d5', 75, 190);

  const camera = new THREE.PerspectiveCamera(
    70,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.1,
    500
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  container.appendChild(renderer.domElement);

  const clock = new THREE.Clock();

  const world = {
    running: true,
    keys: new Set(),
    player: null,
    remotes: new Map(),
    wallTier: 0,
    animationFrame: 0
  };

  const player = {
    id: callbacks.playerId || 'local',
    x: 0,
    y: 18.2,
    z: 12,
    rotation: Math.PI,
    health: 100,
    maxHealth: 100,
    speed: 8,
    vy: 0,
    grounded: true
  };

  world.player = player;

  // --------------------------------------------------
  // 조명
  // --------------------------------------------------

  scene.add(new THREE.HemisphereLight('#e5f4ff', '#79634c', 2.1));

  const sunlight = new THREE.DirectionalLight('#fff1cf', 3.1);

  sunlight.position.set(-35, 65, 25);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -70;
  sunlight.shadow.camera.right = 70;
  sunlight.shadow.camera.top = 70;
  sunlight.shadow.camera.bottom = -70;
  sunlight.shadow.bias = -0.0003;

  scene.add(sunlight);

  // --------------------------------------------------
  // 재사용 가능한 재질
  // --------------------------------------------------

  const materials = {
    sand: new THREE.MeshStandardMaterial({
      color: '#d5bd91',
      roughness: 1
    }),

    sandLight: new THREE.MeshStandardMaterial({
      color: '#e5d0a5',
      roughness: 0.95
    }),

    limestone: new THREE.MeshStandardMaterial({
      color: '#e5d3ae',
      roughness: 0.9
    }),

    limestoneDark: new THREE.MeshStandardMaterial({
      color: '#b59a70',
      roughness: 1
    }),

    gold: new THREE.MeshStandardMaterial({
      color: '#e6bd54',
      metalness: 0.65,
      roughness: 0.3
    }),

    teal: new THREE.MeshStandardMaterial({
      color: '#42d9c0',
      emissive: '#0e8c7a',
      emissiveIntensity: 1.5,
      metalness: 0.35,
      roughness: 0.25
    }),

    stone: new THREE.MeshStandardMaterial({
      color: '#b6a17e',
      roughness: 0.95
    }),

    darkStone: new THREE.MeshStandardMaterial({
      color: '#5b5447',
      roughness: 0.9
    })
  };

  // --------------------------------------------------
  // 공통 오브젝트 생성
  // --------------------------------------------------

  function box(
    x,
    y,
    z,
    width,
    height,
    depth,
    material,
    collision = true
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);

    if (collision) {
      colliders.push({
        minX: x - width / 2,
        maxX: x + width / 2,
        minY: y - height / 2,
        maxY: y + height / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2
      });
    }

    return mesh;
  }

  function cylinder(
    x,
    y,
    z,
    radiusTop,
    radiusBottom,
    height,
    material,
    segments = 12
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radiusTop,
        radiusBottom,
        height,
        segments
      ),
      material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    return mesh;
  }

  function sphere(x, y, z, radius, material, segments = 12) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, segments, segments),
      material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);

    return mesh;
  }

  const colliders = [];

  // --------------------------------------------------
  // 사막 지형
  // --------------------------------------------------

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400, 1, 1),
    materials.sand
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);

  // 사막 타일
  for (let x = -160; x <= 160; x += 20) {
    for (let z = -160; z <= 160; z += 20) {
      if (Math.abs(x) < 45 && Math.abs(z) < 45) continue;

      if (Math.random() > 0.72) {
        const rock = cylinder(
          x + Math.random() * 8 - 4,
          0.05,
          z + Math.random() * 8 - 4,
          0.2 + Math.random() * 0.6,
          0.3 + Math.random() * 0.8,
          0.2 + Math.random() * 0.4,
          materials.limestoneDark,
          6
        );

        rock.rotation.y = Math.random() * Math.PI;
      }
    }
  }

  // --------------------------------------------------
  // 피라미드 계단식 기반
  // 충돌 판정은 별도 지면 계산으로 처리
  // --------------------------------------------------

  for (let level = 0; level < 9; level++) {
    const size = 54 - level * 5.2;
    const height = 1.3;
    const y = level * height;

    box(
      0,
      y,
      0,
      size,
      height,
      size,
      level % 2 === 0
        ? materials.limestone
        : materials.stone,
      false
    );

    // 계단 가장자리 장식
    if (level < 8) {
      const nextSize = size - 5.2;
      const edge = size / 2 - 0.65;

      box(
        0,
        y + 0.68,
        edge,
        size,
        0.12,
        0.18,
        materials.limestoneDark,
        false
      );

      box(
        0,
        y + 0.68,
        -edge,
        size,
        0.12,
        0.18,
        materials.limestoneDark,
        false
      );

      box(
        edge,
        y + 0.68,
        0,
        0.18,
        0.12,
        size,
        materials.limestoneDark,
        false
      );

      box(
        -edge,
        y + 0.68,
        0,
        0.18,
        0.12,
        size,
        materials.limestoneDark,
        false
      );
    }
  }

  // --------------------------------------------------
  // 중앙 신전
  // --------------------------------------------------

  // 신전 바닥
  box(
    0, 17.0, 0,
    26, 0.5, 18,
    materials.limestone,
    false
  );

  // 신전 기둥
  for (const x of [-10, -5, 5, 10]) {
    for (const z of [-6.5, 6.5]) {
      cylinder(
        x, 19.8, z,
        0.65, 0.85, 5,
        materials.limestone,
        12
      );

      cylinder(
        x, 17.35, z,
        1.05, 1.05, 0.4,
        materials.gold,
        12
      );

      cylinder(
        x, 22.25, z,
        0.95, 0.95, 0.35,
        materials.gold,
        12
      );
    }
  }

  // 신전 지붕
  box(
    0, 22.5, 0,
    25, 0.6, 16,
    materials.limestone,
    false
  );

  // 중앙 신호기 받침
  box(
    0, 17.55, 0,
    5, 0.65, 5,
    materials.darkStone,
    false
  );

  box(
    0, 18.1, 0,
    3.6, 0.5, 3.6,
    materials.gold,
    false
  );

  // 신호기 기둥
  const beaconCore = cylinder(
    0, 20.0, 0,
    0.65, 0.9, 3.3,
    materials.teal,
    8
  );

  const beaconTop = sphere(
    0, 22.0, 0,
    0.95,
    materials.teal,
    16
  );

  // 신호기 빛
  const beaconLight = new THREE.PointLight(
    '#4fffe1',
    7,
    35
  );

  beaconLight.position.set(0, 22, 0);
  scene.add(beaconLight);

  // 신호기 장식 링
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.08, 8, 48),
    materials.gold
  );

  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 19.5, 0);
  scene.add(ring);

  // --------------------------------------------------
  // 성벽
  // --------------------------------------------------

  const walls = [];

  function createWalls() {
    for (const wall of walls) {
      scene.remove(wall);
      wall.geometry?.dispose();
    }

    walls.length = 0;

    const tier = world.wallTier;
    const height = 2.5 + tier * 1.2;
    const thickness = 1.2;
    const half = 26;

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: tier >= 3 ? '#b6b8b4' : '#c5b08a',
      roughness: 0.9
    });

    const sections = 12;
    const segment = (half * 2) / sections;

    for (let i = 0; i < sections; i++) {
      const offset = -half + segment * (i + 0.5);

      const positions = [
        [offset, 0, -half],
        [offset, 0, half],
        [-half, 0, offset],
        [half, 0, offset]
      ];

      for (const [x, _y, z] of positions) {
        // 입구는 남쪽 벽 중앙에 남겨둔다.
        if (Math.abs(z - half) < 0.1 && Math.abs(x) < 5) {
          continue;
        }

        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(
            segment + 0.1,
            height,
            thickness
          ),
          wallMaterial
        );

        wall.position.set(
          x,
          17.0 + height / 2,
          z
        );

        wall.castShadow = true;
        wall.receiveShadow = true;

        scene.add(wall);
        walls.push(wall);
      }
    }

    // 벽 위의 방어용 장식
    for (let i = 0; i < sections; i += 2) {
      const offset = -half + segment * (i + 0.5);

      for (const [x, z] of [
        [offset, -half],
        [offset, half],
        [-half, offset],
        [half, offset]
      ]) {
        if (Math.abs(z - half) < 0.1 && Math.abs(x) < 5) {
          continue;
        }

        const merlon = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.65, 1.3),
          materials.limestone
        );

        merlon.position.set(
          x,
          17.0 + height + 0.25,
          z
        );

        scene.add(merlon);
        walls.push(merlon);
      }
    }

    wallMaterial.dispose();
  }

  // --------------------------------------------------
  // 주변 장식
  // --------------------------------------------------

  // 깃발
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 36;
    const z = Math.sin(angle) * 36;

    cylinder(
      x, 2.3, z,
      0.12, 0.12, 4.6,
      materials.gold,
      8
    );

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.0),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? '#42d9c0' : '#e6bd54',
        side: THREE.DoubleSide,
        roughness: 0.8
      })
    );

    flag.position.set(x + 0.75, 3.8, z);
    flag.rotation.y = -angle;
    scene.add(flag);
  }

  // 고대 석상
  for (const x of [-32, 32]) {
    for (const z of [-24, 24]) {
      box(
        x, 1.0, z,
        2.5, 2, 2.5,
        materials.limestoneDark,
        false
      );

      cylinder(
        x, 3.0, z,
        0.65, 0.9, 2,
        materials.limestone,
        8
      );

      sphere(
        x, 4.5, z,
        0.75,
        materials.limestone,
        8
      );
    }
  }

  // --------------------------------------------------
  // 플레이어 생성
  // --------------------------------------------------

  const local = createPlayer('#25b8a7');

  local.group.position.set(
    player.x,
    player.y,
    player.z
  );

  scene.add(local.group);

  // --------------------------------------------------
  // 원격 플레이어 관리
  // --------------------------------------------------

  function addRemote(data) {
    if (!data?.id || data.id === player.id) return;

    if (world.remotes.has(data.id)) {
      updateRemote(data.id, data);
      return;
    }

    const model = createPlayer(
      data.color || '#d6a83d'
    );

    model.group.position.set(
      Number(data.x) || 0,
      Number(data.y) || 0,
      Number(data.z) || 0
    );

    model.group.rotation.y =
      Number(data.rotation) || 0;

    scene.add(model.group);

    world.remotes.set(data.id, {
      model,
      target: {
        x: Number(data.x) || 0,
        y: Number(data.y) || 0,
        z: Number(data.z) || 0,
        rotation: Number(data.rotation) || 0
      },
      health: Number(data.health) || 100,
      username: data.username || 'Player'
    });
  }

  function updateRemote(id, data) {
    if (!id || id === player.id) return;

    let remote = world.remotes.get(id);

    if (!remote) {
      addRemote({ id, ...data });
      return;
    }

    if (Number.isFinite(data.x)) remote.target.x = data.x;
    if (Number.isFinite(data.y)) remote.target.y = data.y;
    if (Number.isFinite(data.z)) remote.target.z = data.z;

    if (Number.isFinite(data.rotation)) {
      remote.target.rotation = data.rotation;
    }

    if (Number.isFinite(data.health)) {
      remote.health = data.health;
    }

    if (data.username) {
      remote.username = data.username;
    }
  }

  function removeRemote(id) {
    const remote = world.remotes.get(id);
    if (!remote) return;

    scene.remove(remote.model.group);

    remote.model.group.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    world.remotes.delete(id);
  }

  // --------------------------------------------------
  // 이동 및 충돌
  // --------------------------------------------------

  const PLAYER_RADIUS = 0.45;
  const PLAYER_HEIGHT = 1.8;
  const WORLD_LIMIT = 100;

  function getFloorY(x, z) {
    const edge = Math.max(
      Math.abs(x),
      Math.abs(z)
    );

    // 신전 내부 바닥
    const insideTemple =
      Math.abs(x) < 13 &&
      Math.abs(z) < 9;

    if (insideTemple) {
      return 17.0;
    }

    // 피라미드 계단
    if (edge < 27) {
      const steps = Math.max(
        0,
        Math.floor((27 - edge) / 5.2)
      );

      return 0.1 + steps * 1.3;
    }

    // 피라미드 외부
    return 0.1;
  }

  function canMove(x, z, nextY = player.y) {
    if (
      x < -WORLD_LIMIT ||
      x > WORLD_LIMIT ||
      z < -WORLD_LIMIT ||
      z > WORLD_LIMIT
    ) {
      return false;
    }

    // 계단식 피라미드의 외곽 경사 판정
    const oldFloor = getFloorY(player.x, player.z);
    const nextFloor = getFloorY(x, z);

    // 한 번에 지나치게 높은 계단으로 이동하지 못하게 한다.
    if (
      nextFloor - oldFloor > 1.35 &&
      nextY < nextFloor + 0.1
    ) {
      return false;
    }

    // 신전 기둥 충돌
    const pillars = [];

    for (const px of [-10, -5, 5, 10]) {
      for (const pz of [-6.5, 6.5]) {
        pillars.push({
          x: px,
          z: pz,
          radius: 0.95
        });
      }
    }

    for (const pillar of pillars) {
      const dx = x - pillar.x;
      const dz = z - pillar.z;

      if (
        Math.hypot(dx, dz) <
        pillar.radius + PLAYER_RADIUS
      ) {
        return false;
      }
    }

    // 신전 벽 충돌
    const insideTemple =
      Math.abs(x) < 13 &&
      Math.abs(z) < 9;

    const onFloor = nextY <= 18.0;

    if (insideTemple && onFloor) {
      // 입구를 통해 들어오도록 남쪽 중앙 통로를 유지한다.
      if (
        Math.abs(x) > 11.3 ||
        Math.abs(z) > 7.3
      ) {
        return false;
      }
    }

    // 성벽 충돌
    if (world.wallTier > 0) {
      const half = 26;
      const inWallBand =
        Math.abs(Math.abs(x) - half) < 1.1 ||
        Math.abs(Math.abs(z) - half) < 1.1;

      const nearEntrance =
        z > half - 1.5 &&
        z < half + 1.5 &&
        Math.abs(x) < 5;

      if (
        inWallBand &&
        !nearEntrance &&
        nextY < 17 + 2.5 + world.wallTier * 1.2
      ) {
        return false;
      }
    }

    // 기타 충돌 상자
    for (const collider of colliders) {
      if (
        nextY + PLAYER_HEIGHT < collider.minY ||
        nextY > collider.maxY
      ) {
        continue;
      }

      if (
        x + PLAYER_RADIUS > collider.minX &&
        x - PLAYER_RADIUS < collider.maxX &&
        z + PLAYER_RADIUS > collider.minZ &&
        z - PLAYER_RADIUS < collider.maxZ
      ) {
        return false;
      }
    }

    return true;
  }

  // --------------------------------------------------
  // 카메라 및 마우스
  // --------------------------------------------------

  let cameraYaw = Math.PI;
  let cameraPitch = 0.25;
  let cameraDistance = 7;
  let pointerDown = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let pointerMoved = false;

  const canvas = renderer.domElement;

  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;

  function onPointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;

    pointerDown = true;
    pointerMoved = false;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!pointerDown) return;

    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;

    if (Math.abs(dx) + Math.abs(dy) > 1) {
      pointerMoved = true;
    }

    cameraYaw -= dx * 0.005;
    cameraPitch -= dy * 0.004;

    cameraPitch = THREE.MathUtils.clamp(
      cameraPitch,
      -0.15,
      0.85
    );

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  function onPointerUp() {
    pointerDown = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onWheel(event) {
    cameraDistance += event.deltaY * 0.006;

    cameraDistance = THREE.MathUtils.clamp(
      cameraDistance,
      3,
      14
    );
  }

  function onKeyDown(event) {
    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)
    ) {
      event.preventDefault();
    }

    world.keys.add(event.code);
  }

  function onKeyUp(event) {
    world.keys.delete(event.code);
  }

  function onBlur() {
    world.keys.clear();
    pointerDown = false;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: true });

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // --------------------------------------------------
  // 이동 처리
  // --------------------------------------------------

  let moveSendTimer = 0;
  let stepTime = 0;

  function movePlayer(delta) {
    if (callbacks.isPaused?.()) return;

    if (player.health <= 0) return;

    const forward =
      (world.keys.has('KeyW') || world.keys.has('ArrowUp') ? 1 : 0) -
      (world.keys.has('KeyS') || world.keys.has('ArrowDown') ? 1 : 0);

    const sideways =
      (world.keys.has('KeyD') || world.keys.has('ArrowRight') ? 1 : 0) -
      (world.keys.has('KeyA') || world.keys.has('ArrowLeft') ? 1 : 0);

    const moving = forward !== 0 || sideways !== 0;

    if (moving) {
      const length = Math.hypot(forward, sideways) || 1;
      const f = forward / length;
      const s = sideways / length;

      const moveAngle = cameraYaw;

      const moveX =
        Math.sin(moveAngle) * f +
        Math.cos(moveAngle) * s;

      const moveZ =
        Math.cos(moveAngle) * f -
        Math.sin(moveAngle) * s;

      const distance = player.speed * delta;

      const nextX = player.x + moveX * distance;
      const nextZ = player.z + moveZ * distance;

      if (canMove(nextX, player.z, player.y)) {
        player.x = nextX;
      }

      if (canMove(player.x, nextZ, player.y)) {
        player.z = nextZ;
      }

      player.rotation = Math.atan2(moveX, moveZ);

      stepTime += delta * 10;

      if (local.arms?.length >= 2) {
        local.arms[0].rotation.x = Math.sin(stepTime) * 0.55;
        local.arms[1].rotation.x = -Math.sin(stepTime) * 0.55;
      }

      if (local.legs?.length >= 2) {
        local.legs[0].rotation.x = Math.sin(stepTime) * 0.65;
        local.legs[1].rotation.x = -Math.sin(stepTime) * 0.65;
      }
    } else {
      if (local.arms?.length >= 2) {
        local.arms[0].rotation.x = THREE.MathUtils.damp(
          local.arms[0].rotation.x,
          0,
          8,
          delta
        );

        local.arms[1].rotation.x = THREE.MathUtils.damp(
          local.arms[1].rotation.x,
          0,
          8,
          delta
        );
      }

      if (local.legs?.length >= 2) {
        local.legs[0].rotation.x = THREE.MathUtils.damp(
          local.legs[0].rotation.x,
          0,
          8,
          delta
        );

        local.legs[1].rotation.x = THREE.MathUtils.damp(
          local.legs[1].rotation.x,
          0,
          8,
          delta
        );
      }
    }

    // 점프
    if (
      world.keys.has('Space') &&
      player.grounded
    ) {
      player.vy = 8;
      player.grounded = false;
    }

    // 중력
    player.vy -= 22 * delta;
    player.y += player.vy * delta;

    // 계단과 지면에 착지
    const floorY = getFloorY(player.x, player.z);

    if (player.y <= floorY) {
      player.y = floorY;
      player.vy = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }

    // 플레이어 위치 갱신
    local.group.position.set(
      player.x,
      player.y,
      player.z
    );

    local.group.rotation.y = player.rotation;

    // 서버에 이동 전송
    moveSendTimer += delta;

    if (moveSendTimer >= 0.05) {
      moveSendTimer = 0;

      callbacks.onMove?.({
        x: player.x,
        y: player.y,
        z: player.z,
        rotation: player.rotation,
        health: player.health
      });
    }
  }

  // --------------------------------------------------
  // 원격 플레이어 보간
  // --------------------------------------------------

  function updateRemotes(delta) {
    for (const remote of world.remotes.values()) {
      const { model, target } = remote;
      const alpha = 1 - Math.exp(-12 * delta);

      model.group.position.x = THREE.MathUtils.lerp(
        model.group.position.x,
        target.x,
        alpha
      );

      model.group.position.y = THREE.MathUtils.lerp(
        model.group.position.y,
        target.y,
        alpha
      );

      model.group.position.z = THREE.MathUtils.lerp(
        model.group.position.z,
        target.z,
        alpha
      );

      const current = model.group.rotation.y;
      const difference = Math.atan2(
        Math.sin(target.rotation - current),
        Math.cos(target.rotation - current)
      );

      model.group.rotation.y = current + difference * alpha;
    }
  }

  // --------------------------------------------------
  // 카메라 추적
  // --------------------------------------------------

  const cameraTarget = new THREE.Vector3();

  function updateCamera(delta) {
    const target = new THREE.Vector3(
      player.x,
      player.y + 1.3,
      player.z
    );

    const horizontal = Math.cos(cameraPitch) * cameraDistance;
    const vertical = Math.sin(cameraPitch) * cameraDistance;

    const desired = new THREE.Vector3(
      target.x + Math.sin(cameraYaw) * horizontal,
      target.y + vertical,
      target.z + Math.cos(cameraYaw) * horizontal
    );

    const alpha = 1 - Math.exp(-8 * delta);

    camera.position.lerp(desired, alpha);
    cameraTarget.lerp(target, alpha);

    camera.lookAt(cameraTarget);
  }

  // --------------------------------------------------
  // 창 크기 변경
  // --------------------------------------------------

  function onResize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.75)
    );
  }

  window.addEventListener('resize', onResize);

  // --------------------------------------------------
  // 게임 애니메이션
  // --------------------------------------------------

  function animate() {
    if (!world.running) return;

    world.animationFrame = requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    if (!callbacks.isPaused?.()) {
      movePlayer(delta);
    }

    updateRemotes(delta);
    updateCamera(delta);

    // 신호기 애니메이션
    beaconCore.rotation.y += delta * 0.8;
    beaconTop.position.y = 22 + Math.sin(elapsed * 2) * 0.2;
    ring.rotation.z += delta * 0.5;
    beaconLight.intensity = 6 + Math.sin(elapsed * 3) * 1.5;

    renderer.render(scene, camera);
  }

  // --------------------------------------------------
  // 초기화 및 반환 API
  // --------------------------------------------------

  createWalls();
  onResize();
  animate();

  return {
    scene,
    camera,
    renderer,
    player,

    addRemote,
    updateRemote,
    removeRemote,

    setWallTier(tier) {
      const nextTier = THREE.MathUtils.clamp(
        Math.floor(Number(tier) || 0),
        0,
        5
      );

      if (nextTier === world.wallTier) return;

      world.wallTier = nextTier;
      createWalls();
    },

    getWallTier() {
      return world.wallTier;
    },

    canMove,

    destroy() {
      if (!world.running) return;

      world.running = false;

      cancelAnimationFrame(world.animationFrame);

      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('wheel', onWheel);

      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);

      for (const id of [...world.remotes.keys()]) {
        removeRemote(id);
      }

      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();

        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}
