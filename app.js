/**
 * SMART EMERGENCY EVACUATION PLANNER
 * Core application: BFS pathfinding, hazard management, UI controller
 */

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
const state = {
  hazardNodes: new Set(),       // disabled nodes
  hazardEdges: new Set(),       // disabled edges "A::B"
  hazardTypes: {},              // nodeId → 'fire'|'smoke'|'closed'|'exit_blocked'
  selectedHazard: 'fire',
  currentPath: null,
  evacuationFailed: false,
  timerInterval: null,
  timerSeconds: 0,
  timerRunning: false,
  builderMode: false,
  builder: {
    nodes: {},      // id → { label, x, y }
    edges: [],      // [a, b]
    selectedNode: null,
    linkSource: null,
  },
  activeFloor: 'ALL',
};

// Edge key — always sorted for consistency
function edgeKey(a, b) {
  return [a, b].sort().join('::');
}

// ─────────────────────────────────────────────────────────────
// BFS PATHFINDER
// ─────────────────────────────────────────────────────────────
function bfsEvacuate(graph, adjacency, exits, start, blockedNodes, blockedEdges) {
  if (blockedNodes.has(start)) return null;

  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (exits.has(current)) return path;

    const neighbors = adjacency[current] || [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      if (blockedNodes.has(neighbor)) continue;
      if (blockedEdges.has(edgeKey(current, neighbor))) continue;

      visited.add(neighbor);
      queue.push([...path, neighbor]);
    }
  }
  return null; // no path found
}

// Find top N alternative paths (BFS variants avoiding previous paths)
function findAlternativePaths(adjacency, exits, start, blockedNodes, blockedEdges, count = 3) {
  const paths = [];
  const usedPaths = new Set();

  // First: find the optimal path
  const optimal = bfsEvacuate(null, adjacency, exits, start, blockedNodes, blockedEdges);
  if (!optimal) return [];

  paths.push(optimal);
  usedPaths.add(optimal.join('->'));

  // Then find alternatives by temporarily blocking nodes from previous paths
  for (let i = 1; i < count; i++) {
    let found = false;
    const prevPath = paths[i - 1];

    // Try blocking each intermediate node of the previous path
    for (let j = 1; j < prevPath.length - 1; j++) {
      const extraBlocked = new Set([...blockedNodes, prevPath[j]]);
      const alt = bfsEvacuate(null, adjacency, exits, start, extraBlocked, blockedEdges);
      if (alt && !usedPaths.has(alt.join('->'))) {
        paths.push(alt);
        usedPaths.add(alt.join('->'));
        found = true;
        break;
      }
    }
    if (!found) break;
  }

  return paths;
}

// ─────────────────────────────────────────────────────────────
// HAZARD MANAGEMENT
// ─────────────────────────────────────────────────────────────
function applyHazard(nodeId, type) {
  state.hazardNodes.add(nodeId);
  state.hazardTypes[nodeId] = type;
  logAudit(`⚠ Hazard applied: ${NODES[nodeId]?.label || nodeId} [${type.toUpperCase()}]`, 'warn');
  _recalculate();
  renderMap();
  renderNodeList();
}

function removeHazard(nodeId) {
  const type = state.hazardTypes[nodeId];
  state.hazardNodes.delete(nodeId);
  delete state.hazardTypes[nodeId];
  logAudit(`✓ Hazard cleared: ${NODES[nodeId]?.label || nodeId}${type ? ' [' + type.toUpperCase() + ']' : ''}`, 'ok');
  _recalculate();
  renderMap();
  renderNodeList();
}

function toggleHazard(nodeId) {
  if (nodeId === START_NODE) {
    showToast('Cannot mark Control Room as hazard — it is the evacuation start point.', 'error');
    return;
  }
  if (state.hazardNodes.has(nodeId)) {
    removeHazard(nodeId);
  } else {
    applyHazard(nodeId, state.selectedHazard);
  }
}

function resetAll() {
  state.hazardNodes.clear();
  state.hazardEdges.clear();
  state.hazardTypes = {};
  stopTimer();
  state.timerSeconds = 0;
  updateTimerDisplay();
  logAudit('🔄 System reset — all hazards cleared', 'info');
  // Use _recalculate to avoid calling renderNodeList before renderMap
  _recalculate();
  renderMap();
  renderNodeList();
  showToast('Scenario reset successfully', 'ok');
}

function applyPreset(presetName) {
  const preset = HAZARD_PRESETS[presetName];
  if (!preset) return;
  resetAll();
  preset.nodes.forEach(n => {
    state.hazardNodes.add(n);
    state.hazardTypes[n] = 'fire';
  });
  preset.edges.forEach(([a, b]) => {
    state.hazardEdges.add(edgeKey(a, b));
  });
  logAudit(`📋 Preset loaded: "${presetName}" — ${preset.description}`, 'info');
  _recalculate();
  renderMap();
  renderNodeList();
  showToast(`Preset: ${presetName}`, 'info');
}

// ─────────────────────────────────────────────────────────────
// ROUTE CALCULATION
// ─────────────────────────────────────────────────────────────
function recalculate() {
  const path = bfsEvacuate(NODES, ADJACENCY, EXITS, START_NODE, state.hazardNodes, state.hazardEdges);
  state.currentPath = path;
  state.evacuationFailed = !path;
  renderRoutePanel();
}

// ─────────────────────────────────────────────────────────────
// TIMER
// ─────────────────────────────────────────────────────────────
function startTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  state.timerInterval = setInterval(() => {
    state.timerSeconds++;
    updateTimerDisplay();
  }, 1000);
  document.getElementById('btn-timer-start').textContent = '⏸ Pause';
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerRunning = false;
  document.getElementById('btn-timer-start').textContent = '▶ Start';
}

function resetTimer() {
  stopTimer();
  state.timerSeconds = 0;
  updateTimerDisplay();
}

function toggleTimer() {
  state.timerRunning ? stopTimer() : startTimer();
}

function updateTimerDisplay() {
  const m = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
  const s = String(state.timerSeconds % 60).padStart(2, '0');
  const el = document.getElementById('timer-display');
  if (el) el.textContent = `${m}:${s}`;

  // Color escalation
  if (el) {
    el.className = 'timer-display';
    if (state.timerSeconds >= 300) el.classList.add('timer-critical');
    else if (state.timerSeconds >= 120) el.classList.add('timer-warn');
  }
}

// ─────────────────────────────────────────────────────────────
// SVG MAP RENDERING
// ─────────────────────────────────────────────────────────────
function getNodeStatus(nodeId) {
  if (nodeId === START_NODE) return 'start';
  if (EXITS.has(nodeId) && state.hazardNodes.has(nodeId)) return 'exit-blocked';
  if (EXITS.has(nodeId)) return 'exit';
  if (state.hazardNodes.has(nodeId)) return 'hazard';
  if (state.currentPath && state.currentPath.includes(nodeId)) return 'path';
  return 'safe';
}

function getHazardIcon(type) {
  const icons = { fire: '🔥', smoke: '💨', closed: '🔒', exit_blocked: '🚫', blocked_path: '⛔' };
  return icons[type] || '⚠';
}

function renderMap() {
  const container = document.getElementById('svg-map-container');
  if (!container) return;

  // Group nodes by floor
  const floorOrder = ['GF', 'F1', 'F2', 'F3', 'B1'];
  const pathSet = new Set(state.currentPath || []);

  let html = '';

  for (const floor of floorOrder) {
    const floorNodes = Object.entries(NODES).filter(([, n]) => n.floor === floor);
    if (!floorNodes.length) continue;

    const floorInfo = FLOORS[floor];
    html += `<div class="floor-section" data-floor="${floor}">
      <div class="floor-label">${floorInfo.label}</div>
      <div class="floor-nodes">`;

    for (const [id, node] of floorNodes) {
      const status = getNodeStatus(id);
      const hazardType = state.hazardTypes[id];
      const isOnPath = pathSet.has(id);
      const isStart = id === START_NODE;
      const isExit = EXITS.has(id);

      let classes = `map-node node-${status} node-type-${node.type}`;
      if (isOnPath) classes += ' node-on-path';

      const pathIndex = state.currentPath ? state.currentPath.indexOf(id) : -1;
      const stepLabel = pathIndex >= 0 ? `<span class="path-step">${pathIndex + 1}</span>` : '';

      html += `
        <div class="${classes}" data-id="${id}" onclick="handleNodeClick('${id}')" title="${node.label}${hazardType ? ' [' + hazardType + ']' : ''}">
          <div class="node-inner">
            ${isStart ? '<span class="node-badge start-badge">START</span>' : ''}
            ${isExit && !hazardType ? '<span class="node-badge exit-badge">EXIT</span>' : ''}
            ${hazardType ? `<span class="hazard-icon">${getHazardIcon(hazardType)}</span>` : ''}
            ${stepLabel}
            <span class="node-label">${node.label}</span>
            <span class="node-type-tag">${node.type}</span>
          </div>
        </div>`;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html;

  // Animate path nodes
  if (state.currentPath) {
    state.currentPath.forEach((id, idx) => {
      const el = container.querySelector(`[data-id="${id}"]`);
      if (el) el.style.animationDelay = `${idx * 0.08}s`;
    });
  }
}

function handleNodeClick(nodeId) {
  toggleHazard(nodeId);
}

// ─────────────────────────────────────────────────────────────
// ROUTE PANEL
// ─────────────────────────────────────────────────────────────
function renderRoutePanel() {
  const panel = document.getElementById('route-panel');
  if (!panel) return;

  if (state.evacuationFailed) {
    panel.innerHTML = `
      <div class="route-failed">
        <div class="failed-icon">☠</div>
        <div class="failed-title">EVACUATION FAILED</div>
        <div class="failed-sub">No safe exit available from Control Room.<br>All viable routes are blocked by hazards.</div>
        <div class="failed-actions">
          <button class="btn btn-reset" onclick="resetAll()">🔄 Clear All Hazards</button>
        </div>
      </div>`;
    updateStatusBar('FAILED', 'danger');
    return;
  }

  if (!state.currentPath) {
    panel.innerHTML = `<div class="route-idle"><div class="idle-icon">🛡</div><p>Building is clear. No hazards detected.</p><p class="idle-sub">Click any room on the map to simulate a hazard.</p></div>`;
    updateStatusBar('CLEAR', 'safe');
    return;
  }

  const path = state.currentPath;
  const exitNode = path[path.length - 1];
  const exitLabel = NODES[exitNode]?.label || exitNode;
  const hops = path.length - 1;

  // Alt paths
  const alts = findAlternativePaths(ADJACENCY, EXITS, START_NODE, state.hazardNodes, state.hazardEdges, 3);

  let stepsHtml = path.map((id, i) => {
    const node = NODES[id];
    const isLast = i === path.length - 1;
    const icon = id === START_NODE ? '🎯' : EXITS.has(id) ? '🚪' : NODES[id]?.type === 'stair' ? '🪜' : '→';
    return `<div class="route-step ${isLast ? 'route-step-exit' : ''}" style="animation-delay:${i * 0.07}s">
      <span class="step-icon">${icon}</span>
      <span class="step-label">${node?.label || id}</span>
      <span class="step-floor">${FLOORS[node?.floor]?.label || ''}</span>
      ${i < path.length - 1 ? '<div class="step-connector"></div>' : ''}
    </div>`;
  }).join('');

  let altHtml = '';
  if (alts.length > 1) {
    altHtml = `<div class="alt-routes">
      <div class="alt-title">Alternative Routes</div>
      ${alts.slice(1).map((alt, i) => {
        const altExit = NODES[alt[alt.length - 1]]?.label || alt[alt.length - 1];
        return `<div class="alt-route">
          <span class="alt-num">${i + 2}</span>
          <span class="alt-path">${alt.map(id => NODES[id]?.label || id).join(' → ')}</span>
          <span class="alt-exit">→ ${altExit}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  panel.innerHTML = `
    <div class="route-success">
      <div class="route-header">
        <div class="route-status-badge">✓ ROUTE FOUND</div>
        <div class="route-meta">${hops} step${hops !== 1 ? 's' : ''} → <strong>${exitLabel}</strong></div>
      </div>
      <div class="route-steps">${stepsHtml}</div>
      ${altHtml}
    </div>`;

  updateStatusBar(`EVACUATE → ${exitLabel}`, 'safe');
}

function updateStatusBar(message, level) {
  const bar = document.getElementById('status-text');
  if (!bar) return;
  bar.textContent = message;
  bar.className = `status-text status-${level}`;
}

// ─────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────
function logAudit(message, type = 'info') {
  const log = document.getElementById('audit-log');
  if (!log) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `audit-entry audit-${type}`;
  entry.innerHTML = `<span class="audit-time">${time}</span><span class="audit-msg">${message}</span>`;
  log.prepend(entry);
  // Cap at 50 entries
  while (log.children.length > 50) log.removeChild(log.lastChild);
}

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────────────────────
// NODE LIST (SIDEBAR)
// ─────────────────────────────────────────────────────────────
function renderNodeList() {
  const list = document.getElementById('node-list');
  if (!list) return;

  const floorOrder = ['GF', 'F1', 'F2', 'F3', 'B1'];
  let html = '';

  for (const floor of floorOrder) {
    const floorNodes = Object.entries(NODES).filter(([, n]) => n.floor === floor);
    if (!floorNodes.length) continue;
    html += `<div class="sidebar-floor-group">
      <div class="sidebar-floor-title">${FLOORS[floor].label}</div>`;
    for (const [id, node] of floorNodes) {
      const hasHazard = state.hazardNodes.has(id);
      const isExit = EXITS.has(id);
      const isStart = id === START_NODE;
      html += `<div class="node-list-item ${hasHazard ? 'item-hazard' : ''} ${isExit ? 'item-exit' : ''} ${isStart ? 'item-start' : ''}"
        onclick="handleNodeClick('${id}')">
        <span class="item-icon">${isStart ? '🎯' : isExit ? '🚪' : node.type === 'stair' ? '🪜' : node.type === 'corridor' ? '🛤' : '🏢'}</span>
        <span class="item-name">${node.label}</span>
        ${hasHazard ? `<span class="item-hazard-badge">${getHazardIcon(state.hazardTypes[id])}</span>` : ''}
      </div>`;
    }
    html += `</div>`;
  }
  list.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// DYNAMIC BUILDING CREATOR
// ─────────────────────────────────────────────────────────────
function initBuilder() {
  state.builderMode = true;
  const canvas = document.getElementById('builder-canvas');
  canvas.innerHTML = '';
  state.builder = { nodes: {}, edges: [], selectedNode: null, linkSource: null };
  renderBuilderCanvas();
  logAudit('🏗 Dynamic Builder activated', 'info');
}

function renderBuilderCanvas() {
  const canvas = document.getElementById('builder-canvas');
  if (!canvas) return;

  let svg = `<svg id="builder-svg" width="100%" height="100%" viewBox="0 0 800 500">
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,255,136,0.08)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="800" height="500" fill="url(#grid)"/>`;

  // Edges
  for (const [a, b] of state.builder.edges) {
    const na = state.builder.nodes[a];
    const nb = state.builder.nodes[b];
    if (!na || !nb) continue;
    svg += `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" stroke="rgba(0,255,136,0.5)" stroke-width="2" stroke-dasharray="6,3"/>`;
  }

  // Nodes
  for (const [id, node] of Object.entries(state.builder.nodes)) {
    const isSelected = state.builder.selectedNode === id;
    const isLinkSrc = state.builder.linkSource === id;
    svg += `
      <g class="builder-node" data-id="${id}" style="cursor:pointer">
        <circle cx="${node.x}" cy="${node.y}" r="28" 
          fill="${isLinkSrc ? 'rgba(255,200,0,0.3)' : isSelected ? 'rgba(0,255,136,0.3)' : 'rgba(15,52,96,0.9)'}" 
          stroke="${isLinkSrc ? '#ffc800' : isSelected ? '#00ff88' : '#1e4d8c'}" stroke-width="${isSelected || isLinkSrc ? 3 : 1.5}"/>
        <text x="${node.x}" y="${node.y - 4}" text-anchor="middle" fill="#e0f0ff" font-size="9" font-family="'Courier New'">${node.label}</text>
        <text x="${node.x}" y="${node.y + 10}" text-anchor="middle" fill="rgba(0,255,136,0.6)" font-size="8">${node.type || 'room'}</text>
      </g>`;
  }

  svg += `</svg>`;
  canvas.innerHTML = svg;

  // Attach SVG click for adding nodes
  const svgEl = document.getElementById('builder-svg');
  svgEl.addEventListener('click', onBuilderCanvasClick);

  // Attach node clicks
  canvas.querySelectorAll('.builder-node').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onBuilderNodeClick(el.dataset.id);
    });
  });
}

function onBuilderCanvasClick(e) {
  if (e.target.closest('.builder-node')) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const svgEl = document.getElementById('builder-svg');
  const vb = svgEl.viewBox.baseVal;
  const scaleX = vb.width / rect.width;
  const scaleY = vb.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const mode = document.getElementById('builder-mode-select').value;
  if (mode === 'add-node') {
    const label = document.getElementById('builder-node-label').value.trim() || `Node${Object.keys(state.builder.nodes).length + 1}`;
    const type = document.getElementById('builder-node-type').value;
    const id = 'B_' + label.replace(/\s+/g, '_') + '_' + Date.now();
    state.builder.nodes[id] = { label, type, x, y };
    document.getElementById('builder-node-label').value = '';
    renderBuilderCanvas();
    runBuilderBFS();
  }
}

function onBuilderNodeClick(id) {
  const mode = document.getElementById('builder-mode-select').value;
  if (mode === 'link') {
    if (!state.builder.linkSource) {
      state.builder.linkSource = id;
      showToast(`Now click another node to link to "${state.builder.nodes[id].label}"`, 'info');
    } else if (state.builder.linkSource !== id) {
      const a = state.builder.linkSource;
      // Check if edge already exists
      const exists = state.builder.edges.some(([x, y]) => (x === a && y === id) || (x === id && y === a));
      if (!exists) {
        state.builder.edges.push([a, id]);
        showToast(`Linked: ${state.builder.nodes[a].label} ↔ ${state.builder.nodes[id].label}`, 'ok');
      }
      state.builder.linkSource = null;
      renderBuilderCanvas();
      runBuilderBFS();
    }
  } else if (mode === 'delete') {
    delete state.builder.nodes[id];
    state.builder.edges = state.builder.edges.filter(([a, b]) => a !== id && b !== id);
    state.builder.linkSource = null;
    renderBuilderCanvas();
    runBuilderBFS();
  } else {
    state.builder.selectedNode = state.builder.selectedNode === id ? null : id;
    renderBuilderCanvas();
  }
}

function runBuilderBFS() {
  const nodes = state.builder.nodes;
  const edges = state.builder.edges;
  const nodeIds = Object.keys(nodes);

  // Build adjacency
  const adj = {};
  nodeIds.forEach(id => adj[id] = []);
  edges.forEach(([a, b]) => {
    if (adj[a]) adj[a].push(b);
    if (adj[b]) adj[b].push(a);
  });

  const starts = nodeIds.filter(id => nodes[id].type === 'start' || nodes[id].type === 'control');
  const exits = new Set(nodeIds.filter(id => nodes[id].type === 'exit'));

  const resultEl = document.getElementById('builder-result');
  if (!resultEl) return;

  if (!starts.length || !exits.size) {
    resultEl.innerHTML = '<span class="builder-hint">Add at least one Start node and one Exit node to compute a path.</span>';
    return;
  }

  const start = starts[0];
  const path = bfsEvacuate(null, adj, exits, start, new Set(), new Set());

  if (path) {
    resultEl.innerHTML = `<span class="builder-path-ok">✓ Path: ${path.map(id => nodes[id]?.label || id).join(' → ')}</span>`;
  } else {
    resultEl.innerHTML = `<span class="builder-path-fail">✗ No path from Start to any Exit</span>`;
  }
}

// ─────────────────────────────────────────────────────────────
// SHOW / HIDE LOADING SCREEN
// ─────────────────────────────────────────────────────────────
function revealApp() {
  const loading = document.getElementById('loading-screen');
  const app = document.getElementById('app');
  if (loading) loading.classList.add('hidden');
  if (app) app.classList.add('visible');
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
function init() {
  try {
    // Hazard type selector
    document.getElementById('hazard-type-select').addEventListener('change', (e) => {
      state.selectedHazard = e.target.value;
    });

    // Floor filter
    document.getElementById('floor-filter').addEventListener('change', (e) => {
      state.activeFloor = e.target.value;
      renderMap();
    });

    // Preset buttons
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });

    // Timer buttons
    document.getElementById('btn-timer-start').addEventListener('click', toggleTimer);
    document.getElementById('btn-timer-reset').addEventListener('click', resetTimer);

    // Builder open/close
    document.getElementById('btn-builder-open').addEventListener('click', () => {
      document.getElementById('builder-modal').classList.add('active');
      initBuilder();
    });
    document.getElementById('btn-builder-close').addEventListener('click', () => {
      document.getElementById('builder-modal').classList.remove('active');
      state.builderMode = false;
    });

    // Builder mode changes
    const builderMode = document.getElementById('builder-mode-select');
    if (builderMode) {
      builderMode.addEventListener('change', () => {
        state.builder.linkSource = null;
        renderBuilderCanvas();
      });
    }

    // Initial render — call internal BFS directly (not the wrapper)
    _recalculate();
    renderMap();
    renderNodeList();
    updateTimerDisplay();

    logAudit('🟢 System initialized — Control Room is evacuation start point', 'ok');
    logAudit('ℹ Click any room on the map to simulate a hazard', 'info');

  } catch (err) {
    console.error('EVAC//SYS init error:', err);
  } finally {
    // Always reveal the app — even if something went wrong
    setTimeout(revealApp, 1200);
  }
}

// Internal recalculate (does NOT call renderNodeList to avoid circular override issues)
function _recalculate() {
  const path = bfsEvacuate(NODES, ADJACENCY, EXITS, START_NODE, state.hazardNodes, state.hazardEdges);
  state.currentPath = path;
  state.evacuationFailed = !path;
  renderRoutePanel();
}

// Public recalculate — used by hazard toggles etc.
function recalculate() {
  _recalculate();
  renderNodeList();
}

document.addEventListener('DOMContentLoaded', init);
