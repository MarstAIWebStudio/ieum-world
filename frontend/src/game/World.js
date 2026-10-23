
import * as THREE from 'three';
import { createPlayer } from './Player.js';

export function createWorld(container, callbacks = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8d2df');
  scene.fog = new THREE.Fog('#b8d2df', 70, 180);

  const camera = new THREE.PerspectiveCamera(
    65,
    container.clientWidth / container.clientHeight,
    0.1,
    500
  );

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight('#e8f5ff', '#71583c', 2));

  const sunlight = new THREE.DirectionalLight('#fff0cf', 3);
  sunlight.position.set(-30, 45, 20);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  scene.add(sunlight);

  const material = (color, roughness = 0.85) =>
    new THREE.MeshStandardMaterial({ color, roughness });

  const sand = material('#d6b77f');
  const limestone = material('#d6c5a5');
  const stone = material('#a69475');
  const gold = new THREE.MeshStandardMaterial({
    color: '#e8bd53',
    metalness: 0.55,
    roughness: 0.3
  });

  const colliders = [];
  const remotes = new Map();
  const clock = new THREE.Clock();
  const keys = new Set();

  function box(x, y, z, sx, sy, sz, mat, collision = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      mat
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (collision) {
      colliders.push({
        x, z, hx: sx / 2, hz: sz / 2
      });
    }

    return mesh;
  }

  // 사막
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    sand
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 계단식 피라미드
  for (let level = 0; level < 9; level++) {
    const size = 54 - level * 5.2;
    box(
      0,
      level * 1.3,
      0,
      size,
      1.3,
      size,
      level % 2 === 0 ? limestone : stone,
      true
    );
  }

  // 신전 기단과 지붕
  box(0, 12.3, 0, 27, 1, 20, limestone, true);
  box(0, 16.5, 0, 29, 0.8, 22, limestone, true);
  box(0, 17.05, 0, 26, 0.35, 19, gold);

  // 기둥
  for (let i = 0; i < 9; i++) {
    const x = -11 + i * 2.75;

    for (const z of [-7.5, 7.5]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.72, 7.5, 12),
        limestone
      );
      pillar.position.set(x, 12.9, z);
      pillar.castShadow = true;
      scene.add(pillar);
    }
  }

  // 중앙 신호기
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.2, 1.5, 8),
    stone
  );
  base.position.set(0, 17.45, 0);
  scene.add(base);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshStandardMaterial({
      color: '#7ff6ff',
      emissive: '#159ee5',
      emissiveIntensity: 2.5,
      metalness: 0.3,
      roughness: 0.15
    })
  );
  crystal.position.set(0, 19.4, 0);
  scene.add(crystal);

  const beaconLight = new THREE.PointLight('#40dcff', 45, 35);
  beaconLight.position.set(0, 20, 0);
  scene.add(beaconLight);

  // 주변 사막 바위
  for (let i = 0; i < 40; i++) {
    const angle = i * Math.PI * 2 / 40;
    const radius = 48 + (i % 5) * 5;
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(1.5 + i % 3, 3 + i % 4, 5),
      i % 2 ? sand : limestone
    );
    rock.position.set(
      Math.cos(angle) * radius,
      1,
      Math.sin(angle) * radius
    );
    rock.castShadow = true;
    scene.add(rock);
  }

  // 성벽
  let wallMeshes = [];

  function buildWalls(tier = 0) {
    for (const mesh of wallMeshes) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }

    wallMeshes = [];

    const height = 2.5 + tier * 0.8;
    const half = 24 + tier * 1.5;
    const thick = 1.5 + tier * 0.2;

    wallMeshes.push(box(0, height / 2, -half, half * 2, height, thick, limestone));
    wallMeshes.push(box(0, height / 2, half, half * 2, height, thick, limestone));
    wallMeshes.push(box(-half, height / 2, 0, thick, height, half * 2, limestone));
    wallMeshes.push(box(half, height / 2, 0, thick, height, half * 2, limestone));

    for (let i = 0; i < 4; i++) {
      const x = -half + i * half * 0.65;
      const merlon = box(x, height + 0.35, -half, 1.4, 0.7, 1.7, stone);
      wallMeshes.push(merlon);
    }
  }

  buildWalls(0);

  const local = createPlayer('#25b8a7');
  scene.add(local.group);

  const player = {
    id: callbacks.playerId || 'local',
    x: 0,
    y: 18.2,
    z: 12,
    rotation: Math.PI,
    health: 100,
    maxHealth: 100,
    speed: 9,
    vy: 0,
    grounded: false
  };

  let yaw = 0;
  let pitch = 0.18;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastEmit = 0;
  let disposed = false;
  let raf = 0;

  function addRemote(id, data = {}) {
    if (id === player.id || remotes.has(id)) return;

    const model = createPlayer(data.color || '#d6a83d');
    scene.add(model.group);
    remotes.set(id, model);
  }

  function updateRemote(id, data) {
    if (id === player.id) return;
    if (!remotes.has(id)) addRemote(id, data);

    const model = remotes.get(id);
    if (!model) return;

    model.group.position.set(data.x || 0, data.y || 0, data.z || 0);
    model.group.rotation.y = data.rotation || 0;
  }

  function removeRemote(id) {
    const model = remotes.get(id);
    if (!model) return;
    scene.remove(model.group);
    remotes.delete(id);
  }

  function canMove(x, z) {
    for (const c of colliders) {
      const closestX = THREE.MathUtils.clamp(x, c.x - c.hx, c.x + c.hx);
      const closestZ = THREE.MathUtils.clamp(z, c.z - c.hz, c.z + c.hz);

      if (Math.hypot(x - closestX, z - closestZ) < 0.65) {
        return false;
      }
    }
    return true;
  }

  function onKeyDown(event) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerMove(event) {
    if (!dragging) return;

    yaw -= (event.clientX - lastX) * 0.004;
    pitch = THREE.MathUtils.clamp(
      pitch + (event.clientY - lastY) * 0.003,
      -0.25,
      0.9
    );

    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerUp() {
    dragging = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', resize);

  function animate() {
    if (disposed) return;
    raf = requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();

    crystal.rotation.y += dt * 0.7;
    crystal.position.y = 19.4 + Math.sin(now * 0.002) * 0.22;
    beaconLight.intensity = 42 + Math.sin(now * 0.003) * 8;

    if (!callbacks.isPaused?.()) {
      let forward = 0;
      let side = 0;

      if (keys.has('KeyW')) forward += 1;
      if (keys.has('KeyS')) forward -= 1;
      if (keys.has('KeyD')) side += 1;
      if (keys.has('KeyA')) side -= 1;

      const len = Math.hypot(forward, side) || 1;
      forward /= len;
      side /= len;

      const dx = (Math.sin(yaw) * forward + Math.cos(yaw) * side);
      const dz = (Math.cos(yaw) * forward - Math.sin(yaw) * side);
      const speed = player.speed * (keys.has('ShiftLeft') ? 1.35 : 1);

      const nx = player.x + dx * speed * dt;
      const nz = player.z - dz * speed * dt;

      if (canMove(nx, player.z)) player.x = nx;
      if (canMove(player.x, nz)) player.z = nz;

      if (keys.has('Space') && player.grounded) {
        player.vy = 7.5;
        player.grounded = false;
      }

      player.vy -= 20 * dt;
      player.y += player.vy * dt;

      // 계단식 피라미드 위의 기본 지면 높이
      const edge = Math.max(Math.abs(player.x), Math.abs(player.z));
      const steps = edge < 27 ? Math.max(0, Math.floor((27 - edge) / 5.2)) : 0;
      const floorY = 0.1 + steps * 1.3;

      if (player.y <= floorY) {
        player.y = floorY;
        player.vy = 0;
        player.grounded = true;
      }

      local.group.position.set(player.x, player.y, player.z);
      if (forward || side) {
        player.rotation = Math.atan2(dx, dz);
        local.group.rotation.y = player.rotation;
      }

      const walking = forward !== 0 || side !== 0;
      local.arms[0].rotation.x = walking ? Math.sin(now * 0.012) * 0.4 : 0;
      local.arms[1].rotation.x = walking ? -Math.sin(now * 0.012) * 0.4 : 0;

      const target = new THREE.Vector3(player.x, player.y + 1.5, player.z);
      const distance = 8;
      camera.position.set(
        player.x + Math.sin(yaw) * distance,
        player.y + 3 + pitch * 4,
        player.z + Math.cos(yaw) * distance
      );
      camera.lookAt(target);

      if (now - lastEmit > 80) {
        callbacks.onMove?.({
          x: player.x,
          y: player.y,
          z: player.z,
          rotation: player.rotation,
          health: player.health
        });
        lastEmit = now;
      }
    }

    renderer.render(scene, camera);
  }

  animate();

  return {
    scene,
    player,
    addRemote,
    updateRemote,
    removeRemote,
    setWallTier(tier) {
      buildWalls(Math.max(0, Math.min(5, tier)));
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);

      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);

      renderer.dispose();
      renderer.domElement.remove();

      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          for (const mat of Array.isArray(object.material)
            ? object.material : [object.material]) {
            mat.dispose();
          }
        }
      });
    }
  };
}
