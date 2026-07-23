import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Protective network mesh — abstract API graph for the hero.
 * Uses transforms only; disposed cleanly on unmount.
 */
export default function HeroScene({ className }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0.2, 6.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Core icosahedron — protective shell
    const coreGeo = new THREE.IcosahedronGeometry(1.15, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xd8dce3,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Outer protective lattice
    const shellGeo = new THREE.IcosahedronGeometry(1.85, 0);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x8b919c,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    group.add(shell);

    // Node points on a sphere
    const nodeCount = 48;
    const positions = new Float32Array(nodeCount * 3);
    const nodeVecs = [];
    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 1.85;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      nodeVecs.push(new THREE.Vector3(x, y, z));
    }

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pointsMat = new THREE.PointsMaterial({
      color: 0xf2f3f5,
      size: 0.05,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pointsGeo, pointsMat);
    group.add(points);

    // Connection lines between nearby nodes
    const linePositions = [];
    const maxDist = 1.35;
    for (let i = 0; i < nodeVecs.length; i++) {
      for (let j = i + 1; j < nodeVecs.length; j++) {
        if (nodeVecs[i].distanceTo(nodeVecs[j]) < maxDist) {
          linePositions.push(
            nodeVecs[i].x,
            nodeVecs[i].y,
            nodeVecs[i].z,
            nodeVecs[j].x,
            nodeVecs[j].y,
            nodeVecs[j].z
          );
        }
      }
    }
    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePositions, 3)
    );
    const linesMat = new THREE.LineBasicMaterial({
      color: 0x8b919c,
      transparent: true,
      opacity: 0.22,
    });
    const lines = new THREE.LineSegments(linesGeo, linesMat);
    group.add(lines);

    // Soft ambient fill via second faint shell
    const glowGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x1a1a1e,
      transparent: true,
      opacity: 0.45,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    group.rotation.x = 0.28;
    group.position.x = 0.15;
    group.position.y = 0.05;
    group.scale.setScalar(1.05);

    let frame = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const onResize = () => {
      const nw = mount.clientWidth || window.innerWidth;
      const nh = mount.clientHeight || window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    };
    window.addEventListener("resize", onResize);

    const pointer = { x: 0, y: 0 };
    const onPointer = (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    if (!reduceMotion) {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      frame++;

      if (!reduceMotion) {
        group.rotation.y = t * 0.12 + pointer.x * 0.15;
        group.rotation.x = 0.35 + pointer.y * 0.08;
        shell.rotation.y = -t * 0.08;
        core.rotation.y = t * 0.18;
        core.rotation.z = t * 0.06;
        // Pulse opacity gently without layout work
        pointsMat.opacity = 0.7 + Math.sin(t * 1.4) * 0.15;
      }

      // Skip every other frame on small screens when reduceMotion
      if (reduceMotion && frame % 2 === 1) return;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      coreGeo.dispose();
      coreMat.dispose();
      shellGeo.dispose();
      shellMat.dispose();
      pointsGeo.dispose();
      pointsMat.dispose();
      linesGeo.dispose();
      linesMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
