import { createGate } from './gates.js';
import { createWire } from './wires.js';
import { renderGate, updateGatePosition, updateGateValues, updateWirePath, getPinCenter } from './renderer.js';
import { recompute } from './simulator.js';

const workspace = document.getElementById('workspace');
const nodeLayer = document.getElementById('node-layer');
const wireLayer = document.getElementById('wire-layer');
const handleLayer = document.getElementById('wire-handles');
const expressionLabel = document.getElementById('expression-label');

const state = {
    gates: [],
    wires: [],
    nodes: new Map()
};

let dragTarget = null;
let dragOffset = { x: 0, y: 0 };
let wiring = null;
let previewPath = null;

function addGate(type, x = 120, y = 120, options = {}) {
    const gate = createGate(type, x, y);
    if (options.label) {
        gate.label = options.label;
    }
    state.gates.push(gate);
    const node = renderGate(gate, nodeLayer);
    state.nodes.set(gate.id, node);
    updateGateValues(gate, node);
    updateAllWires();
    return gate;
}

function addWire(fromId, toId, inputIndex) {
    const wire = createWire(fromId, toId, inputIndex);
    wire.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    wire.path.classList.add('wire');
    wire.path.dataset.wireId = wire.id;
    wireLayer.appendChild(wire.path);

    wire.deleteHandle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wire.deleteHandle.classList.add('wire-delete');
    wire.deleteHandle.dataset.wireId = wire.id;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '10');
    wire.deleteHandle.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('y', '3');
    text.textContent = 'x';
    wire.deleteHandle.appendChild(text);

    handleLayer.appendChild(wire.deleteHandle);
    state.wires.push(wire);
    return wire;
}

function updateAllWires() {
    const gateMap = new Map(state.gates.map((gate) => [gate.id, gate]));

    state.wires.forEach((wire) => {
        const fromGate = gateMap.get(wire.fromId);
        const toGate = gateMap.get(wire.toId);
        const path = wire.path;
        const deleteHandle = wire.deleteHandle;
        if (!fromGate || !toGate || !path) {
            return;
        }

        const fromNode = state.nodes.get(fromGate.id);
        const toNode = state.nodes.get(toGate.id);
        if (!fromNode || !toNode) {
            return;
        }

        const fromPin = fromNode.querySelector('.pin.output');
        const toPin = toNode.querySelector(`.pin.input[data-pin-index="${wire.inputIndex}"]`);
        if (!fromPin || !toPin) {
            return;
        }

        const from = getPinCenter(fromPin, workspace);
        const to = getPinCenter(toPin, workspace);
        updateWirePath(path, from, to);
        path.classList.toggle('active', fromGate.output === 1);
        if (deleteHandle) {
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            deleteHandle.setAttribute('transform', `translate(${midX}, ${midY})`);
        }
    });
}

function updateSimulation() {
    recompute(state);
    state.gates.forEach((gate) => {
        const node = state.nodes.get(gate.id);
        if (node) {
            updateGateValues(gate, node);
        }
    });
    updateAllWires();
    computeExpression();
}

function handleAddClick(event) {
    const btn = event.target.closest('[data-add]');
    if (!btn) {
        return;
    }
    const type = btn.dataset.add;
    addGate(type, 140 + Math.random() * 180, 140 + Math.random() * 120);
    updateSimulation();
}

function handleWorkspacePointerDown(event) {
    const pin = event.target.closest('.pin');
    if (pin && pin.dataset.pinType === 'output') {
        const gateId = pin.dataset.gateId;
        wiring = { fromId: gateId };
        previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        previewPath.classList.add('wire', 'preview');
        wireLayer.appendChild(previewPath);
        return;
    }

    const node = event.target.closest('.node');
    if (!node) {
        return;
    }

    dragTarget = node;
    dragTarget.classList.add('dragging');
    const gate = state.gates.find((item) => item.id === node.dataset.gateId);
    if (!gate) {
        return;
    }

    const rect = node.getBoundingClientRect();
    dragOffset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function handleWorkspacePointerMove(event) {
    if (dragTarget) {
        const gate = state.gates.find((item) => item.id === dragTarget.dataset.gateId);
        if (!gate) {
            return;
        }

        const workspaceRect = workspace.getBoundingClientRect();
        gate.x = event.clientX - workspaceRect.left - dragOffset.x;
        gate.y = event.clientY - workspaceRect.top - dragOffset.y;
        updateGatePosition(dragTarget, gate);
        updateAllWires();
    }

    if (previewPath && wiring) {
        const fromGate = state.gates.find((item) => item.id === wiring.fromId);
        const fromNode = state.nodes.get(fromGate.id);
        const fromPin = fromNode.querySelector('.pin.output');
        const from = getPinCenter(fromPin, workspace);
        const to = {
            x: event.clientX - workspace.getBoundingClientRect().left,
            y: event.clientY - workspace.getBoundingClientRect().top
        };
        updateWirePath(previewPath, from, to);
    }
}

function handleWorkspacePointerUp(event) {
    if (dragTarget) {
        dragTarget.classList.remove('dragging');
        dragTarget = null;
    }

    if (previewPath && wiring) {
        const inputPin = event.target.closest('.pin.input');
        if (inputPin) {
            const toId = inputPin.dataset.gateId;
            const inputIndex = Number(inputPin.dataset.pinIndex);
            addWire(wiring.fromId, toId, inputIndex);
        }
        previewPath.remove();
        previewPath = null;
        wiring = null;
        updateSimulation();
    }
}

function handleWireClick(event) {
    const handle = event.target.closest('.wire-delete');
    if (!handle) {
        return;
    }

    const wireId = handle.dataset.wireId;
    if (!wireId) {
        return;
    }

    const wireIndex = state.wires.findIndex((wire) => wire.id === wireId);
    if (wireIndex !== -1) {
        state.wires.splice(wireIndex, 1);
    }
    handle.remove();
    wireLayer.querySelector(`.wire[data-wire-id="${wireId}"]`)?.remove();
    updateSimulation();
}

function handleNodeClick(event) {
    const toggle = event.target.closest('[data-action="toggle-input"]');
    if (!toggle) {
        return;
    }

    const node = toggle.closest('.node');
    const gate = state.gates.find((item) => item.id === node.dataset.gateId);
    if (!gate) {
        return;
    }

    gate.output = gate.output === 1 ? 0 : 1;
    updateSimulation();
}

function handleNodeChange(event) {
    const labelSelect = event.target.closest('[data-action="set-label"]');
    if (!labelSelect) {
        return;
    }

    const gate = state.gates.find((item) => item.id === labelSelect.dataset.gateId);
    if (!gate) {
        return;
    }

    gate.label = labelSelect.value;
    computeExpression();
}

function isSimple(expr) {
    return /^[A-Z0-9?]+$/i.test(expr);
}

function wrap(expr) {
    return isSimple(expr) ? expr : `(${expr})`;
}

function combine(symbolic) {
    return symbolic;
}

function computeExpression() {
    if (!expressionLabel) {
        return;
    }

    const gateMap = new Map(state.gates.map((gate) => [gate.id, gate]));
    const wireMap = new Map();
    state.wires.forEach((wire) => {
        wireMap.set(`${wire.toId}:${wire.inputIndex}`, wire);
    });

    const outputGate = state.gates.find((gate) => gate.type === 'OUTPUT');
    if (!outputGate) {
        expressionLabel.textContent = '-';
        return;
    }

    const buildExpr = (gateId, visiting = new Set()) => {
        const gate = gateMap.get(gateId);
        if (!gate) {
            return '?';
        }

        if (visiting.has(gateId)) {
            return '⟳';
        }

        visiting.add(gateId);

        const inputExpr = (index) => {
            const wire = wireMap.get(`${gate.id}:${index}`);
            if (!wire) {
                return '?';
            }
            return buildExpr(wire.fromId, visiting);
        };

        let expr = '?';
        switch (gate.type) {
            case 'INPUT':
                expr = gate.label || 'A';
                break;
            case 'OUTPUT': {
                const a = inputExpr(0);
                expr = a;
                break;
            }
            case 'NOT': {
                const a = inputExpr(0);
                expr = combine(`¬${wrap(a)}`, `NOT ${a}`);
                break;
            }
            case 'AND': {
                const a = inputExpr(0);
                const b = inputExpr(1);
                expr = combine(`${a} · ${b}`, `${a} AND ${b}`);
                break;
            }
            case 'OR': {
                const a = inputExpr(0);
                const b = inputExpr(1);
                expr = combine(`${a} + ${b}`, `${a} OR ${b}`);
                break;
            }
            case 'NAND': {
                const a = inputExpr(0);
                const b = inputExpr(1);
                expr = combine(`¬(${a} · ${b})`, `${a} NAND ${b}`);
                break;
            }
            case 'NOR': {
                const a = inputExpr(0);
                const b = inputExpr(1);
                expr = combine(`¬(${a} + ${b})`, `${a} NOR ${b}`);
                break;
            }
            case 'XOR': {
                const a = inputExpr(0);
                const b = inputExpr(1);
                expr = combine(`${a} ⊕ ${b}`, `${a} XOR ${b}`);
                break;
            }
            case 'XNOR': {
                const a = inputExpr(0);
                const b = inputExpr(1);
                expr = combine(`${a} ⊙ ${b}`, `${a} XNOR ${b}`);
                break;
            }
            default:
                expr = '?';
        }

        visiting.delete(gateId);
        return expr;
    };

    expressionLabel.textContent = buildExpr(outputGate.id) || '-';
}

function setupPreset() {
    const selectedGate = localStorage.getItem('selectedGate');
    if (selectedGate) {
        localStorage.removeItem('selectedGate');
    }

    const gateType = selectedGate || 'AND';

    const inputA = addGate('INPUT', 140, 160, { label: 'A' });
    const inputB = addGate('INPUT', 140, 260, { label: 'B' });
    const logicGate = addGate(gateType, 360, 200);
    const outputGate = addGate('OUTPUT', 600, 220);

    addWire(inputA.id, logicGate.id, 0);
    if (gateType !== 'NOT') {
        addWire(inputB.id, logicGate.id, 1);
    }
    addWire(logicGate.id, outputGate.id, 0);
}

function init() {
    document.querySelectorAll('[data-add]').forEach((btn) => {
        btn.addEventListener('click', handleAddClick);
    });

    workspace.addEventListener('pointerdown', handleWorkspacePointerDown);
    window.addEventListener('pointermove', handleWorkspacePointerMove);
    window.addEventListener('pointerup', handleWorkspacePointerUp);
    nodeLayer.addEventListener('click', handleNodeClick);
    handleLayer.addEventListener('pointerdown', handleWireClick);
    nodeLayer.addEventListener('change', handleNodeChange);

    setupPreset();
    updateSimulation();
}

init();
