import type { EngagementRecord } from './types';
import { cosineSimilarity, clamp01 } from './vector';

/**
 * Collaborative filtering (Stage 2b): classic user–item co-engagement model
 * (GroupLens lineage). Each player is a row over engaged item ids
 * (sessions, courts, matches); cosine similarity between rows measures
 * behavioral affinity.
 */
export class InteractionMatrix {
  private readonly byPlayer = new Map<string, Map<string, number>>();
  private readonly itemIndex = new Map<string, number>();

  constructor(records: EngagementRecord[] = []) {
    for (const r of records) this.add(r);
  }

  add(record: EngagementRecord): void {
    if (!this.itemIndex.has(record.itemId)) {
      this.itemIndex.set(record.itemId, this.itemIndex.size);
    }
    const row = this.byPlayer.get(record.playerId) ?? new Map<string, number>();
    row.set(record.itemId, (row.get(record.itemId) ?? 0) + (record.weight ?? 1));
    this.byPlayer.set(record.playerId, row);
  }

  /** Number of engagement entries recorded for a player. */
  interactionCount(playerId: string): number {
    const row = this.byPlayer.get(playerId);
    if (!row) return 0;
    let n = 0;
    for (const v of row.values()) n += v;
    return n;
  }

  private denseRow(playerId: string): number[] | null {
    const row = this.byPlayer.get(playerId);
    if (!row || row.size === 0) return null;
    const dense = new Array<number>(this.itemIndex.size).fill(0);
    for (const [itemId, weight] of row) {
      dense[this.itemIndex.get(itemId)!] = weight;
    }
    return dense;
  }

  /**
   * Behavioral similarity ∈ [0,1]. Returns null when either player has no
   * history — callers treat null as "CF unavailable" (cold start), which is
   * distinct from "similar history exists but shares nothing" (0).
   */
  similarity(a: string, b: string): number | null {
    const ra = this.denseRow(a);
    const rb = this.denseRow(b);
    if (!ra || !rb) return null;
    return clamp01(cosineSimilarity(ra, rb));
  }
}
