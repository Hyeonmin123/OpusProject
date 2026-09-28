import type { ActMap, MapNode, NodeType } from '../types';
import type { Rng } from './rng';

/** Regular rows per act (the boss row is added on top). */
export const MAP_REGULAR_ROWS = 10;
export const MAP_COLS = 5;
const PATH_COUNT = 4;

const cellKey = (row: number, col: number) => `${row},${col}`;

/**
 * Builds a branching path graph in the style of Slay the Spire:
 * several random walks from the bottom row to the top, each step moving
 * to the column left/straight/right of the current one without crossing an
 * existing edge. The union of those walks becomes the map; every node in
 * the top regular row connects to a single boss node.
 */
export function generateMap(rng: Rng, act: number): ActMap {
  const rows = MAP_REGULAR_ROWS;
  const cells = new Set<string>();
  const edges = new Map<string, Set<string>>();
  const hasEdge = (r: number, c1: number, c2: number) =>
    edges.get(cellKey(r, c1))?.has(cellKey(r + 1, c2)) ?? false;

  const startCols: number[] = [];
  for (let p = 0; p < PATH_COUNT; p++) {
    let col = rng.int(0, MAP_COLS - 1);
    // Guarantee at least two distinct entry points.
    if (p === 1) while (col === startCols[0]) col = rng.int(0, MAP_COLS - 1);
    startCols.push(col);

    for (let r = 0; r < rows; r++) {
      cells.add(cellKey(r, col));
      if (r === rows - 1) break;
      const candidates = rng.shuffle([col - 1, col, col + 1].filter((c) => c >= 0 && c < MAP_COLS));
      const next =
        candidates.find((nc) => {
          if (nc === col + 1) return !hasEdge(r, col + 1, col);
          if (nc === col - 1) return !hasEdge(r, col - 1, col);
          return true;
        }) ?? col;
      const k = cellKey(r, col);
      if (!edges.has(k)) edges.set(k, new Set());
      edges.get(k)!.add(cellKey(r + 1, next));
      col = next;
    }
  }

  const id = (r: number, c: number) => `a${act}-r${r}c${c}`;
  const bossId = `a${act}-boss`;
  const nodes: Record<string, MapNode> = {};
  for (const k of cells) {
    const [r, c] = k.split(',').map(Number);
    const next = [...(edges.get(k) ?? [])].map((nk) => {
      const [nr, nc] = nk.split(',').map(Number);
      return id(nr, nc);
    });
    nodes[id(r, c)] = { id: id(r, c), row: r, col: c, type: 'combat', next };
  }
  for (const node of Object.values(nodes)) {
    if (node.row === rows - 1) node.next = [bossId];
  }
  nodes[bossId] = {
    id: bossId,
    row: rows,
    col: Math.floor(MAP_COLS / 2),
    type: 'boss',
    next: [],
  };

  assignNodeTypes(rng, nodes, rows);

  const startIds = Object.values(nodes)
    .filter((n) => n.row === 0)
    .sort((a, b) => a.col - b.col)
    .map((n) => n.id);

  return { act, rows: rows + 1, cols: MAP_COLS, nodes, startIds, bossId };
}

const SPECIAL: NodeType[] = ['elite', 'rest', 'shop'];

function rollType(rng: Rng, row: number, rows: number): NodeType {
  const table: Array<[NodeType, number]> = [
    ['combat', 50],
    ['event', 22],
  ];
  if (row >= 2) table.push(['shop', 9]);
  if (row >= 4) table.push(['elite', 11]);
  if (row >= 4 && row <= rows - 3) table.push(['rest', 8]);
  return rng.weighted(table);
}

function assignNodeTypes(rng: Rng, nodes: Record<string, MapNode>, rows: number): void {
  const parents = new Map<string, MapNode[]>();
  for (const n of Object.values(nodes)) {
    for (const child of n.next) {
      if (!parents.has(child)) parents.set(child, []);
      parents.get(child)!.push(n);
    }
  }

  const regular = Object.values(nodes)
    .filter((n) => n.type !== 'boss')
    .sort((a, b) => a.row - b.row || a.col - b.col);

  for (const node of regular) {
    if (node.row === 0) {
      node.type = 'combat';
      continue;
    }
    if (node.row === rows - 1) {
      node.type = 'rest'; // campfire right before the boss
      continue;
    }
    const parentTypes = (parents.get(node.id) ?? []).map((p) => p.type);
    let type = rollType(rng, node.row, rows);
    // Avoid back-to-back elites/rests/shops on the same path.
    for (
      let tries = 0;
      tries < 8 && SPECIAL.includes(type) && parentTypes.includes(type);
      tries++
    ) {
      type = rollType(rng, node.row, rows);
    }
    if (SPECIAL.includes(type) && parentTypes.includes(type)) type = 'combat';
    node.type = type;
  }

  // Every act gets at least one elite (mid-boss) and one shop.
  ensureType(rng, regular, 'elite', (n) => n.row >= 4 && n.row <= rows - 2);
  ensureType(rng, regular, 'shop', (n) => n.row >= 2 && n.row <= rows - 2);
}

function ensureType(
  rng: Rng,
  nodes: MapNode[],
  type: NodeType,
  allowed: (n: MapNode) => boolean,
): void {
  if (nodes.some((n) => n.type === type)) return;
  const candidates = nodes.filter((n) => allowed(n) && (n.type === 'combat' || n.type === 'event'));
  if (candidates.length > 0) rng.pick(candidates).type = type;
}

/** Nodes the player may move to next. */
export function reachableNodeIds(map: ActMap, currentNodeId: string | null): string[] {
  if (currentNodeId === null) return map.startIds;
  return map.nodes[currentNodeId]?.next ?? [];
}
