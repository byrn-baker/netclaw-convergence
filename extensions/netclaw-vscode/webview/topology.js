import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { topologyModel } from "./topology-model";
const root = document.createElement("section");
root.className = "topology-stage";
root.setAttribute("aria-label", "Interactive BGP session graph");
document.getElementById("content").before(root);
const text = (tag, value, parent, cls) => {
  const e = document.createElement(tag);
  e.textContent = value;
  if (cls) e.className = cls;
  parent.append(e);
  return e;
};
text("p", "BGP / SESSION MAP", root, "eyebrow");
text("h2", "Connections in perspective", root);
text(
  "p",
  "Reported BGP sessions · not physical cabling. Drag to orbit; use the controls to zoom or select a session.",
  root,
  "hint",
);
const notice = text("p", "Waiting for a source observation…", root, "hint");
notice.setAttribute("role", "status");
const surface = text("div", "", root, "topology-surface");
const toolbar = text("div", "", root, "toolbar");
const label = text("label", "Selected session", toolbar);
label.htmlFor = "graph-selection";
const select = text("select", "", toolbar);
select.id = "graph-selection";
select.setAttribute("aria-describedby", "graph-detail");
const detail = text("p", "", root, "notice");
detail.id = "graph-detail";
const buttons = ["Zoom in", "Zoom out", "Reset view", "Hide graph"].map((v) =>
  text("button", v, toolbar, "secondary"),
);
let renderer,
  controls,
  scene,
  camera,
  meshes = [],
  lines = [],
  labels = [],
  frame = 0,
  disposed = false,
  graph,
  observation,
  hidden = false,
  resize,
  theme;
function requestRender() {
  if (disposed || hidden || document.hidden || !renderer || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    renderer?.render(scene, camera);
    for (const { element, mesh } of labels) {
      const point = mesh.position.clone().project(camera);
      element.hidden =
        point.z > 1 ||
        (meshes.length > 30 && mesh.userData.id !== select.value);
      element.style.left = ((point.x + 1) / 2) * surface.clientWidth + "px";
      element.style.top = ((1 - point.y) / 2) * 320 + 18 + "px";
    }
  });
}
function colors() {
  const css = getComputedStyle(document.body);
  return {
    node: css.getPropertyValue("--vscode-charts-blue").trim() || "#288fe8",
    selected:
      css.getPropertyValue("--vscode-charts-purple").trim() || "#bb68ca",
    edge:
      css.getPropertyValue("--vscode-descriptionForeground").trim() ||
      "#888888",
  };
}
function recolor() {
  const c = colors();
  for (const m of meshes)
    m.material.color.set(m.userData.id === select.value ? c.selected : c.node);
  for (const l of lines) l.material.color.set(c.edge);
  requestRender();
}
function selected() {
  const n = graph?.nodes.find((n) => n.id === select.value);
  detail.textContent = n
    ? `${n.role}: ${n.label} · AS ${n.asn ?? "not reported"} · ${n.state}`
    : "No reported session selected.";
  recolor();
}
function clearScene() {
  for (const x of [...meshes, ...lines]) {
    scene?.remove(x);
    x.geometry.dispose();
    x.material.dispose();
  }
  meshes = [];
  lines = [];
  labels.forEach(({ element }) => element.remove());
  labels = [];
}
function resizeScene() {
  if (!renderer) return;
  const w = Math.max(surface.clientWidth, 1),
    h = 320;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  requestRender();
}
function lose() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  controls?.dispose();
  controls = undefined;
  clearScene();
  renderer?.dispose();
  renderer = undefined;
  surface.replaceChildren();
  notice.textContent =
    "3D is unavailable. Select a session above or use the complete peer cards below.";
}
function init() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute(
      "aria-label",
      "Decorative BGP session layout; use the session selector for details",
    );
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        lose();
      },
      { once: true },
    );
    surface.append(renderer.domElement);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x293149, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 7, 4);
    scene.add(key);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 5, 10);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.minDistance = 2;
    controls.maxDistance = 28;
    controls.addEventListener("change", requestRender);
    resizeScene();
    renderer.domElement.addEventListener("pointerup", (event) => {
      if (!renderer) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        p = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        ray = new THREE.Raycaster();
      ray.setFromCamera(p, camera);
      const found = ray.intersectObjects(meshes)[0]?.object;
      if (found) {
        select.value = found.userData.id;
        selected();
      }
    });
  } catch {
    lose();
  }
}
function update(event) {
  if (
    disposed ||
    event.detail.kind !== "topology" ||
    observation === event.detail.observation
  )
    return;
  observation = event.detail.observation;
  graph = topologyModel(observation);
  const old = select.value;
  select.replaceChildren();
  for (const n of graph.nodes) {
    const option = text("option", `${n.label} · ${n.state}`, select);
    option.value = n.id;
  }
  if (graph.nodes.some((n) => n.id === old)) select.value = old;
  notice.textContent = !graph.available
    ? "BGP source unavailable."
    : `${graph.nodes.length} of ${graph.total} reported nodes in 3D${graph.total > 200 ? " · display limited to 200; the full list remains below" : ""}. ${graph.source}`;
  if (!renderer) init();
  if (renderer) {
    clearScene();
    const positions = new Map();
    graph.nodes.forEach((n, i) => {
      const local = n.role === "Local speaker",
        angle = ((i - 1) * Math.PI * 2) / Math.max(1, graph.nodes.length - 1),
        position = local
          ? new THREE.Vector3(0, 0, 0)
          : new THREE.Vector3(
              Math.cos(angle) * 3.6,
              Math.sin(angle * 2 + 0.7 + i) * 1.0,
              Math.sin(angle) * 3.6,
            );
      positions.set(n.id, position);
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(local ? 0.42 : 0.25, 1),
        new THREE.MeshStandardMaterial({
          color: colors().node,
          metalness: 0.35,
          roughness: 0.36,
          flatShading: true,
        }),
      );
      mesh.position.copy(position);
      mesh.userData.id = n.id;
      scene.add(mesh);
      meshes.push(mesh);
      const element = text("span", n.label, surface, "graph-label");
      element.setAttribute("aria-hidden", "true");
      labels.push({ element, mesh });
    });
    for (const edge of graph.edges) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          positions.get(edge.from),
          positions.get(edge.to),
        ]),
        new THREE.LineBasicMaterial({
          color: colors().edge,
          transparent: true,
          opacity: 0.75,
        }),
      );
      scene.add(line);
      lines.push(line);
    }
  }
  selected();
  requestRender();
}
select.addEventListener("change", selected);
buttons[0].onclick = () => {
  if (camera) {
    camera.position.multiplyScalar(0.8);
    controls?.update();
    requestRender();
  }
};
buttons[1].onclick = () => {
  if (camera) {
    camera.position.multiplyScalar(1.25);
    controls?.update();
    requestRender();
  }
};
buttons[2].onclick = () => {
  if (camera) {
    camera.position.set(0, 5, 10);
    controls?.target.set(0, 0, 0);
    controls?.update();
    requestRender();
  }
};
buttons[3].onclick = () => {
  hidden = !hidden;
  surface.hidden = hidden;
  buttons[3].textContent = hidden ? "Show graph" : "Hide graph";
  if (hidden && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  } else resizeScene();
};
function visibility() {
  if (document.hidden && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  } else requestRender();
}
function dispose() {
  if (disposed) return;
  disposed = true;
  if (frame) cancelAnimationFrame(frame);
  resize?.disconnect();
  theme?.disconnect();
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("netclaw:observation", update);
  window.removeEventListener("netclaw:invalidate", dispose);
  controls?.dispose();
  clearScene();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = undefined;
  surface.replaceChildren();
  for (const b of buttons) b.disabled = true;
  select.disabled = true;
}
resize = new ResizeObserver(resizeScene);
resize.observe(surface);
theme = new MutationObserver(recolor);
theme.observe(document.body, {
  attributes: true,
  attributeFilter: ["class", "style", "data-vscode-theme-id"],
});
document.addEventListener("visibilitychange", visibility);
window.addEventListener("netclaw:observation", update);
window.addEventListener("netclaw:invalidate", dispose);
window.addEventListener("pagehide", dispose, { once: true });
if (window.netclawObservation) update({ detail: window.netclawObservation });
