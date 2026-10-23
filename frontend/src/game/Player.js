
import * as THREE from 'three';

export function createPlayer(color = '#29b8a5') {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7
  });

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: '#d7a57b'
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.15, 0.48),
    bodyMaterial
  );
  body.position.y = 1.45;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 16, 12),
    skinMaterial
  );
  head.position.y = 2.25;
  head.castShadow = true;
  group.add(head);

  const arms = [];
  const legs = [];

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.82, 0.27),
      skinMaterial
    );
    arm.position.set(side * 0.53, 1.47, 0);
    arm.castShadow = true;
    group.add(arm);
    arms.push(arm);

    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.78, 0.34),
      new THREE.MeshStandardMaterial({ color: '#343b50' })
    );
    leg.position.set(side * 0.21, 0.42, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.22
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  return { group, body, head, arms, legs };
}
