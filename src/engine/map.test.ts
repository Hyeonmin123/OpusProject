import { describe, expect, it } from 'vitest';
import { MAP_REGULAR_ROWS, generateMap } from './map';
import { Rng } from './rng';

describe('map generator', () => {
  for (const seed of [1, 2, 3, 42, 999, 123456]) {
    it(`produces a valid branching graph (seed ${seed})`, () => {
      const map = generateMap(new Rng(seed), 1);
      const nodes = Object.values(map.nodes);

      expect(map.startIds.length).toBeGreaterThanOrEqual(2);
      expect(map.nodes[map.bossId].type).toBe('boss');

      // Edges only go up exactly one row, at most one column sideways.
      for (const n of nodes) {
        for (const nextId of n.next) {
          const child = map.nodes[nextId];
          expect(child).toBeDefined();
          expect(child.row).toBe(n.row + 1);
          if (child.type !== 'boss') expect(Math.abs(child.col - n.col)).toBeLessThanOrEqual(1);
        }
        if (n.type !== 'boss') expect(n.next.length).toBeGreaterThan(0);
      }

      // Every node is reachable from the start and can reach the boss.
      const reachable = new Set<string>();
      const stack = [...map.startIds];
      while (stack.length) {
        const id = stack.pop()!;
        if (reachable.has(id)) continue;
        reachable.add(id);
        stack.push(...map.nodes[id].next);
      }
      expect(reachable.size).toBe(nodes.length);

      // Row rules: first row fights, campfire before the boss, one elite + shop minimum.
      nodes.filter((n) => n.row === 0).forEach((n) => expect(n.type).toBe('combat'));
      nodes
        .filter((n) => n.row === MAP_REGULAR_ROWS - 1)
        .forEach((n) => expect(n.type).toBe('rest'));
      expect(nodes.some((n) => n.type === 'elite')).toBe(true);
      expect(nodes.some((n) => n.type === 'shop')).toBe(true);

      // No crossing edges between adjacent columns.
      for (const n of nodes) {
        for (const nextId of n.next) {
          const child = map.nodes[nextId];
          if (child.type === 'boss' || child.col === n.col) continue;
          const neighbour = nodes.find((m) => m.row === n.row && m.col === child.col);
          const crossing = neighbour?.next.some((id) => map.nodes[id].col === n.col);
          expect(crossing ?? false).toBe(false);
        }
      }
    });
  }
});
