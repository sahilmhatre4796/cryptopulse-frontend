// ─── CryptoPulse 3D Scenes (Three.js r128) ─────────────────────────────────
// Two lightweight WebGL scenes: an ambient particle network and a rotating
// glass-style coin used as a hero accent. Both render transparent and are
// safe to mount/unmount.

const CP3D = (() => {

  function particleNetwork(canvas) {
    if (!window.THREE) return null;
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 60;

    const COUNT = 90;
    const positions = new Float32Array(COUNT * 3);
    const velocities = [];
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      velocities.push({
        x: (Math.random() - 0.5) * 0.04,
        y: (Math.random() - 0.5) * 0.04,
        z: (Math.random() - 0.5) * 0.02
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x00f0ff, size: 1.6, transparent: true, opacity: 0.85, sizeAttenuation: true });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Line connections (rebuilt each frame from proximity)
    const lineGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.12 });
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineMesh);

    let raf;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    function animate() {
      const pos = geometry.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        pos[i * 3] += velocities[i].x;
        pos[i * 3 + 1] += velocities[i].y;
        pos[i * 3 + 2] += velocities[i].z;
        if (Math.abs(pos[i * 3]) > 70) velocities[i].x *= -1;
        if (Math.abs(pos[i * 3 + 1]) > 45) velocities[i].y *= -1;
        if (Math.abs(pos[i * 3 + 2]) > 30) velocities[i].z *= -1;
      }
      geometry.attributes.position.needsUpdate = true;

      // Rebuild proximity lines every few frames for perf
      const linePositions = [];
      const THRESH = 22;
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = pos[i * 3] - pos[j * 3];
          const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
          const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < THRESH) {
            linePositions.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
            linePositions.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
          }
        }
      }
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));

      scene.rotation.y += 0.0009;
      scene.rotation.x = Math.sin(Date.now() * 0.0001) * 0.05;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    return { destroy: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); } };
  }

  function rotatingCoin(canvas, symbol = 'BTC', color = 0x00f0ff) {
    if (!window.THREE) return null;
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(3, 4, 5);
    scene.add(dir);
    const rim = new THREE.PointLight(color, 1.4, 20);
    rim.position.set(-3, -2, 3);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    // Coin body: cylinder, glassy metallic look
    const coinGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.32, 64);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.85, roughness: 0.25, emissive: color, emissiveIntensity: 0.06 });
    const coin = new THREE.Mesh(coinGeo, coinMat);
    group.add(coin);

    // Rim ring (glowing edge)
    const ringGeo = new THREE.TorusGeometry(1.8, 0.045, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Inner wireframe icosahedron floating inside, for "data" feel
    const icoGeo = new THREE.IcosahedronGeometry(0.85, 0);
    const icoMat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.5 });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    ico.position.z = 0.3;
    group.add(ico);

    let raf;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    function animate() {
      t += 0.01;
      group.rotation.y += 0.012;
      group.rotation.x = Math.sin(t * 0.6) * 0.18;
      ico.rotation.x += 0.02;
      ico.rotation.y -= 0.015;
      group.position.y = Math.sin(t) * 0.08;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    return { destroy: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); } };
  }

  return { particleNetwork, rotatingCoin };
})();
