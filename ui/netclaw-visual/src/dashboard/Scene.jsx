import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const COLORS = { member: 0x65c7bd, edge: 0x8bb8ed, peer: 0xe5b96b, advisor: 0xbc9be0, router: 0x8bb8ed, local: 0xff754c };
export default function Scene({ rows, onSelect, network = false }) {
  const host = useRef(null), select = useRef(onSelect);
  const [error, setError] = useState(null);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    const el = host.current; let renderer, frame, observer, controls, disposed = false;
    const scene = new THREE.Scene(), resources = [];
    const stop = () => { cancelAnimationFrame(frame); frame = null; };
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      el.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-label', 'Risk relationships. Use the entity list below for keyboard navigation.');
      const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
      camera.position.set(0, 7, 17);
      controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.minDistance = 6; controls.maxDistance = 30;
      const meshes = [];
      const items = [{ key: 'local', name: network ? 'Local BGP speaker' : 'Local Claw', kind: 'local' }, ...rows.slice(0, 200)];
      items.forEach((row, i) => {
        const lane = network ? 1 : ['member', 'edge', 'peer', 'advisor'].indexOf(row.kind);
        const siblings = items.filter(x => x.kind === row.kind); const j = siblings.indexOf(row);
        const pos = i === 0 ? [0, 0, 0] : [(lane - 1.5) * 3.2, (j - (siblings.length - 1) / 2) * 1.3, -2 - lane * .5];
        const geometry = row.kind === 'advisor' ? new THREE.OctahedronGeometry(.4) : new THREE.BoxGeometry(i ? .48 : .85, i ? .48 : .85, i ? .48 : .85);
        const material = new THREE.MeshBasicMaterial({ color: COLORS[row.kind] || COLORS.member });
        const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...pos); mesh.userData.key = row.key; scene.add(mesh); meshes.push(mesh); resources.push(geometry, material);
        const labelCanvas = document.createElement('canvas'); labelCanvas.width = 512; labelCanvas.height = 96;
        const ctx = labelCanvas.getContext('2d');
        if (ctx) {
          ctx.font = '28px sans-serif'; ctx.fillStyle = '#dce8f4'; ctx.fillText(String(row.name).slice(0, 28), 8, 35);
          ctx.font = '21px monospace'; ctx.fillStyle = '#94aabd'; ctx.fillText(row.kind, 8, 68);
          const texture = new THREE.CanvasTexture(labelCanvas), labelMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
          const label = new THREE.Sprite(labelMaterial); label.position.copy(mesh.position).add(new THREE.Vector3(1.4, .32, 0)); label.scale.set(2.5, .47, 1); scene.add(label); resources.push(texture, labelMaterial);
        }

        if (i) { const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), mesh.position]); const material = new THREE.LineBasicMaterial({ color: COLORS[row.kind], transparent: true, opacity: .35 }); scene.add(new THREE.Line(geometry, material)); resources.push(geometry, material); }
      });
      const bounds = new THREE.Box3().setFromObject(scene), sphere = bounds.getBoundingSphere(new THREE.Sphere());
      const distance = Math.max(17, sphere.radius / Math.sin(THREE.MathUtils.degToRad(21)));
      camera.position.copy(sphere.center).add(new THREE.Vector3(0, distance * .3, distance)); controls.target.copy(sphere.center); controls.maxDistance = distance * 3; camera.far = Math.max(100, distance * 5); camera.updateProjectionMatrix(); controls.update();
      const render = () => { if (!disposed && !document.hidden) renderer.render(scene, camera); };
      controls.addEventListener('change', render);
      const size = () => { const w = Math.max(1, el.clientWidth); renderer.setSize(w, 340); camera.aspect = w / 340; camera.updateProjectionMatrix(); render(); };
      observer = new ResizeObserver(size); observer.observe(el); size();
      const ray = new THREE.Raycaster();
      const click = e => { const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1, -(e.clientY-r.top)/r.height*2+1), camera); const hit = ray.intersectObjects(meshes)[0]; if (hit && hit.object.userData.key !== 'local') select.current(hit.object.userData.key); };
      const loss = e => { e.preventDefault(); stop(); setError('3D context lost. All entities remain available in the list.'); };
      renderer.domElement.addEventListener('click', click); renderer.domElement.addEventListener('webglcontextlost', loss);
      document.addEventListener('visibilitychange', render);
      return () => { disposed = true; stop(); document.removeEventListener('visibilitychange', render); observer.disconnect(); controls.dispose(); resources.forEach(r => r.dispose()); renderer.dispose(); renderer.domElement.remove(); };
    } catch { setError('3D is unavailable on this device. Use the complete entity list below.'); renderer?.dispose(); resources.forEach(r => r.dispose()); observer?.disconnect(); controls?.dispose(); }
  }, [rows, network]);
  return <div className="scene"><div ref={host} hidden={!!error}/>{error && <p className="notice">{error}</p>}<p className="muted">{network ? 'Observed BGP sessions · not physical cabling.' : 'Membership and federation relationships · not physical network links.'} Drag to orbit, scroll to zoom. {rows.length > 200 && '3D limited to the first 200 entities; filter the full list.'}</p><div className="legend">{Object.entries(COLORS).map(([kind, color]) => <span key={kind}><i style={{ background: `#${color.toString(16).padStart(6,'0')}` }}/>{kind}</span>)}</div></div>;
}
