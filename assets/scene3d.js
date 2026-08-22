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

  function marketGlobe(canvas, coinData) {
    if (!window.THREE) return null;
    var THREE = window.THREE;
    coinData = coinData || [];
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 4);

    var ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    var dirLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);
    var backLight = new THREE.DirectionalLight(0x7c5cfc, 0.8);
    backLight.position.set(-5, -3, -5);
    scene.add(backLight);

    var globeGroup = new THREE.Group();
    scene.add(globeGroup);

    var sphereGeo = new THREE.SphereGeometry(1.2, 64, 64);
    var sphereMat = new THREE.MeshStandardMaterial({ color: 0x050510, metalness: 0.3, roughness: 0.7, transparent: true, opacity: 0.9 });
    globeGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

    var wireGeo = new THREE.SphereGeometry(1.22, 32, 32);
    var wireMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.08 });
    var wireGlobe = new THREE.Mesh(wireGeo, wireMat);
    globeGroup.add(wireGlobe);

    var latLines = new THREE.Group();
    var lat, r, y, curve, pts, lGeo, lMat;
    for (lat = -60; lat <= 60; lat += 30) {
      r = 1.23 * Math.cos(lat * Math.PI / 180);
      y = 1.23 * Math.sin(lat * Math.PI / 180);
      curve = new THREE.EllipseCurve(0, 0, r, r, 0, 2 * Math.PI, false);
      pts = curve.getPoints(64);
      lGeo = new THREE.BufferGeometry().setFromPoints(pts.map(function(p) { return new THREE.Vector3(p.x, y, p.y); }));
      lMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.1 });
      latLines.add(new THREE.Line(lGeo, lMat));
    }
    globeGroup.add(latLines);

    var pinGroup = new THREE.Group();
    globeGroup.add(pinGroup);

    function placePins(data) {
      while (pinGroup.children.length) pinGroup.remove(pinGroup.children[0]);
      var coins = data.slice(0, 12);
      coins.forEach(function(coin, i) {
        var phi = Math.acos(-1 + (2 * i) / coins.length);
        var theta = Math.sqrt(coins.length * Math.PI) * phi;
        var pinColor = (coin.price_change_percentage_24h || 0) >= 0 ? 0x00ff94 : 0xff2e2e;
        var pinGeo = new THREE.SphereGeometry(0.025, 8, 8);
        var pinMat = new THREE.MeshBasicMaterial({ color: pinColor });
        var pin = new THREE.Mesh(pinGeo, pinMat);
        var px = 1.24 * Math.sin(phi) * Math.cos(theta);
        var py = 1.24 * Math.sin(phi) * Math.sin(theta);
        var pz = 1.24 * Math.cos(phi);
        pin.position.set(px, py, pz);
        pinGroup.add(pin);
        var glowGeo = new THREE.SphereGeometry(0.045, 8, 8);
        var glowMat = new THREE.MeshBasicMaterial({ color: pinColor, transparent: true, opacity: 0.25 });
        var glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(pin.position);
        pinGroup.add(glow);
      });
    }
    placePins(coinData);

    var ringCount = 200;
    var ringPos = new Float32Array(ringCount * 3);
    var ringCol = new Float32Array(ringCount * 3);
    var i, angle, radius, hc;
    for (i = 0; i < ringCount; i++) {
      angle = (i / ringCount) * Math.PI * 2;
      radius = 1.6 + (Math.random() - 0.5) * 0.2;
      ringPos[i * 3] = Math.cos(angle) * radius;
      ringPos[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      ringPos[i * 3 + 2] = Math.sin(angle) * radius;
      hc = new THREE.Color().setHSL(0.5 + Math.random() * 0.15, 1, 0.6);
      ringCol[i * 3] = hc.r; ringCol[i * 3 + 1] = hc.g; ringCol[i * 3 + 2] = hc.b;
    }
    var ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    ringGeo.setAttribute('color', new THREE.BufferAttribute(ringCol, 3));
    var ringMat = new THREE.PointsMaterial({ size: 0.012, transparent: true, opacity: 0.6, vertexColors: true, sizeAttenuation: true });
    var ringParticles = new THREE.Points(ringGeo, ringMat);
    globeGroup.add(ringParticles);

    var raf;
    var mouseX = 0, mouseY = 0;
    function onMove(e) {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener('mousemove', onMove);

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    function animate() {
      globeGroup.rotation.y += 0.002;
      globeGroup.rotation.x += (mouseY * 0.15 - globeGroup.rotation.x) * 0.02;
      globeGroup.rotation.z += (mouseX * -0.1 - globeGroup.rotation.z) * 0.02;
      ringParticles.rotation.y -= 0.003;
      wireGlobe.rotation.y += 0.001;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    return {
      updateData: function(newData) { placePins(newData); },
      destroy: function() {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', onMove);
        renderer.dispose();
      }
    };
  }

  return { particleNetwork, rotatingCoin, marketGlobe };
})();
