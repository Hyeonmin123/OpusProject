export type NodeType = 'combat' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';

export interface MapNode {
  id: string;
  /** 0 = bottom (entry) row; the boss sits on the last row. */
  row: number;
  col: number;
  type: NodeType;
  /** Ids of nodes reachable from this one (on row + 1). */
  next: string[];
}

export interface ActMap {
  act: number;
  /** Number of rows including the boss row. */
  rows: number;
  cols: number;
  nodes: Record<string, MapNode>;
  /** Nodes on row 0 the player may start the act from. */
  startIds: string[];
  bossId: string;
}
