/**
 * BSP Tiling Manager with Dynamic Tree Structure and Lerping
 *
 * This engine manages windows as leaves in a binary tree (Binary Space Partitioning).
 * Dragging a window allows you to re-insert it into the tree,
 * splitting any existing window horizontally or vertically.
 *
 * The layout is calculated recursively, and window positions are smoothly
 * animated using a Linear Interpolation (Lerp) approach.
 */

const workspaceContainers = Array.from(document.querySelectorAll('.tiling-workspace'));
const LERP_FACTOR = 0.25;
const DRAG_LERP_FACTOR = 0.6;
const GAPS = 10;

class TilingNode {
    constructor(data = null) {
        this.window = data;
        this.split = 'h';
        this.ratio = 0.5;
        this.children = [];
        this.parent = null;
        this.target = { x: 0, y: 0, w: 0, h: 0 };
    }

    isLeaf() {
        return this.window !== null;
    }

    setChildren(a, b) {
        this.children = [a, b];
        a.parent = this;
        b.parent = this;
        this.window = null;
    }
}

class WorkspaceManager {
    constructor(workspaceEl) {
        this.workspaceEl = workspaceEl;
        this.windowElements = Array.from(workspaceEl.querySelectorAll('.generic-window-window'));
        this.windowStates = this.windowElements.map(el => {
            const node = new TilingNode({
                el,
                target: { x: 0, y: 0, w: 0, h: 0 },
                current: { x: 0, y: 0, w: 0, h: 0 }
            });
            return { el, node, isDragging: false, manager: this };
        });
        this.root = null;
        this.initTree();
    }

    initTree() {
        const nodes = this.windowStates.map(s => s.node);
        if (nodes.length === 0) return;

        this.root = nodes[0];
        let leafToSplit = this.root;

        for (let i = 1; i < nodes.length; i++) {
            const newNode = new TilingNode();
            newNode.split = (i % 2 !== 0) ? 'h' : 'v';
            const p = leafToSplit.parent;
            if (!p) {
                this.root = newNode;
            } else {
                const idx = p.children.indexOf(leafToSplit);
                p.children[idx] = newNode;
                newNode.parent = p;
            }
            newNode.setChildren(leafToSplit, nodes[i]);
            leafToSplit = nodes[i];
        }
    }

    calculateLayout(node, rect) {
        node.target = { ...rect };
        if (node.isLeaf()) {
            node.window.target = { ...rect };
            return;
        }

        const [a, b] = node.children;
        if (node.split === 'h') {
            const wA = (rect.w - GAPS) * node.ratio;
            this.calculateLayout(a, { x: rect.x, y: rect.y, w: wA, h: rect.h });
            this.calculateLayout(b, { x: rect.x + wA + GAPS, y: rect.y, w: rect.w - wA - GAPS, h: rect.h });
        } else {
            const hA = (rect.h - GAPS) * node.ratio;
            this.calculateLayout(a, { x: rect.x, y: rect.y, w: rect.w, h: hA });
            this.calculateLayout(b, { x: rect.x, y: rect.y + hA + GAPS, w: rect.w, h: rect.h - hA - GAPS });
        }
    }

    updateTargets() {
        if (this.workspaceEl.classList.contains('hidden')) return;
        const wsRect = this.workspaceEl.getBoundingClientRect();
        if (wsRect.width === 0 || wsRect.height === 0) return;
        this.calculateLayout(this.root, {
            x: GAPS,
            y: GAPS,
            w: wsRect.width - GAPS * 2,
            h: wsRect.height - GAPS * 2
        });
    }

    findLeafAt(node, x, y) {
        if (node.isLeaf()) return node;
        for (const child of node.children) {
            const t = child.target;
            if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
                return this.findLeafAt(child, x, y);
            }
        }
        return null;
    }

    uprootNode(node) {
        if (node === this.root) return;
        const p = node.parent;
        const sibling = p.children.find(c => c !== node);
        const gp = p.parent;
        if (!gp) {
            this.root = sibling;
            this.root.parent = null;
        } else {
            const idx = gp.children.indexOf(p);
            gp.children[idx] = sibling;
            sibling.parent = gp;
        }
    }

    insertNode(nodeToInsert, targetLeaf, side) {
        const p = targetLeaf.parent;
        const newNode = new TilingNode();
        newNode.split = (side === 'left' || side === 'right') ? 'h' : 'v';
        if (!p) {
            this.root = newNode;
            newNode.parent = null;
        } else {
            const idx = p.children.indexOf(targetLeaf);
            p.children[idx] = newNode;
            newNode.parent = p;
        }
        if (side === 'left' || side === 'top') {
            newNode.setChildren(nodeToInsert, targetLeaf);
        } else {
            newNode.setChildren(targetLeaf, nodeToInsert);
        }
    }
}

const managers = workspaceContainers.map(el => new WorkspaceManager(el));
const windowStates = managers.flatMap(manager => manager.windowStates);
let draggedState = null;
let currentMouse = { x: 0, y: 0 };
let mouseOffset = { x: 0, y: 0 };
let previewNode = null;
let previewSide = 'left';

function animate() {
    windowStates.forEach(state => {
        const win = state.node.window;
        if (state.isDragging) {
            win.current.x += (currentMouse.x - mouseOffset.x - win.current.x) * DRAG_LERP_FACTOR;
            win.current.y += (currentMouse.y - mouseOffset.y - win.current.y) * DRAG_LERP_FACTOR;
        } else {
            win.current.x += (win.target.x - win.current.x) * LERP_FACTOR;
            win.current.y += (win.target.y - win.current.y) * LERP_FACTOR;
            win.current.w += (win.target.w - win.current.w) * LERP_FACTOR;
            win.current.h += (win.target.h - win.current.h) * LERP_FACTOR;
        }

        state.el.style.left = `${win.current.x}px`;
        state.el.style.top = `${win.current.y}px`;
        state.el.style.width = `${win.current.w}px`;
        state.el.style.height = `${win.current.h}px`;
    });

    requestAnimationFrame(animate);
}

windowStates.forEach(state => {
    state.el.addEventListener('mousedown', (e) => {
        if (e.target.closest('a, button, input, textarea, select')) return;
        const stateToStart = state;
        draggedState = stateToStart;
        stateToStart.isDragging = true;
        stateToStart.el.classList.add('dragging');
        const rect = stateToStart.el.getBoundingClientRect();
        mouseOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        stateToStart.manager.uprootNode(stateToStart.node);
        stateToStart.manager.updateTargets();
    });
});

window.addEventListener('mousemove', (e) => {
    if (!draggedState) return;
    const wsRect = draggedState.manager.workspaceEl.getBoundingClientRect();
    currentMouse = { x: e.clientX - wsRect.left, y: e.clientY - wsRect.top };
    const leaf = draggedState.manager.findLeafAt(draggedState.manager.root, currentMouse.x, currentMouse.y);
    if (leaf && leaf !== draggedState.node) {
        previewNode = leaf;
        const t = leaf.target;
        const relX = (currentMouse.x - t.x) / t.w;
        const relY = (currentMouse.y - t.y) / t.h;
        const dists = {
            left: relX,
            right: 1 - relX,
            top: relY,
            bottom: 1 - relY
        };
        previewSide = Object.keys(dists).reduce((a, b) => dists[a] < dists[b] ? a : b);
    } else {
        previewNode = null;
    }
});

window.addEventListener('mouseup', () => {
    if (!draggedState) return;
    if (previewNode) {
        draggedState.manager.insertNode(draggedState.node, previewNode, previewSide);
    } else {
        let leaf = draggedState.manager.root;
        while (!leaf.isLeaf()) leaf = leaf.children[0];
        draggedState.manager.insertNode(draggedState.node, leaf, 'left');
    }
    draggedState.el.classList.remove('dragging');
    draggedState.isDragging = false;
    draggedState = null;
    previewNode = null;
    managers.forEach(manager => manager.updateTargets());
});

window.addEventListener('resize', () => managers.forEach(manager => manager.updateTargets()));

function showViewport(targetId) {
    const target = document.getElementById(targetId);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
    }
}

document.querySelectorAll('.viewport-toggle').forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        const target = button.dataset.target;
        if (target) showViewport(target);
    });
});

document.querySelectorAll('.copy-license-button').forEach(button => {
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetId = button.dataset.copyTarget;
        const target = document.getElementById(targetId);
        if (!target) return;
        const text = target.textContent;
        try {
            await navigator.clipboard.writeText(text);
            const original = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => { button.textContent = original; }, 1500);
        } catch (err) {
            console.error('Copy failed', err);
        }
    });
});

function triggerExitAnimation() {
    windowStates.forEach(state => {
        state.el.classList.remove('window-entry');
        state.el.classList.add('window-exit');
    });
}

window.addEventListener('beforeunload', triggerExitAnimation);

managers.forEach(manager => manager.updateTargets());
windowStates.forEach(state => state.node.window.current = { ...state.node.window.target });
animate();
