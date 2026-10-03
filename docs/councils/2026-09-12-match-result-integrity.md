# LLM Council Transcript: Match Result Consistency & Verification Architecture
**Date**: September 12–13, 2026  
**Methodology**: Karpathy-Style LLM Council (5 Autonomous Thinking Lenses + Anonymous Peer Review + Chairman Synthesis)  
**Topic**: Validation and Real-World Failure Scenario Expansion of `match_result_integrity_architecture.md`  
**Status**: Adopted & Formalized into `docs/match-result-integrity-spec.md`  

---

## 1. Framed Council Prompt

**Question**: *Is the 5-layer consistency and integrity architecture described in `match_result_integrity_architecture.md` robust, practical, and mathematically sound for a real-world community pickleball app in Calamba & Los Baños? What edge cases, attack vectors, behavioral failure modes, and unexplored scenarios could compromise match result integrity, and how should they be addressed?*

**System Constraints**:
- Single shared TypeScript engine package (`packages/engine`).
- Calibrated thesis threshold $\tau^* = 0.90$.
- Boost-only Collaborative Filtering invariant ($S = \text{content} + w \cdot \text{cfSim} \cdot (1 - \text{content})$).
- Deterministic Stage 1 safety gates ($|\Delta\text{tier}| \le 1$, Haversine radius, 60+ min schedule overlap).
- Strict RA 10173 data privacy (offline on-device computation in $< 1\text{ ms}$).

---

## 2. Round 1: Autonomous Advisor Perspectives

### The Contrarian
*Exposed the "Walk-On Death Spiral" and the "Sore Loser Veto":*
1. For casual walk-ons, no in-app proposal exists ($S_{\text{chat}} = 0$). In singles, $S_{\text{consensus}} = 0$. Without photos ($S_{\text{proof}} = 0$), only the Trust Differential remains (max 0.35). With equal trust, confidence $C = 0.175 \ll 0.70$. **Every disputed singles walk-on match was mathematically guaranteed to auto-fail and void.**
2. This creates a malicious incentive: losing players can simply click "Decline" on any walk-on match knowing it will auto-void without penalty.
3. Ghosting opponents leave matches stuck in `confirmed: false` purgatory forever.
4. Newbie accounts are penalized in disputes against established veterans solely due to account age.

### The First Principles Thinker
*Exposed the "Binary Fallacy":*
1. Conflating "scoreline typo" with "fraudulent dispute" forces players to choose between full acceptance or formal confrontation.
2. In 80% of real-world disputes, both players agree on the winner, but disagree on exact points (e.g., `11-9` vs `11-7`).
3. True physical ground truth is co-location (mutual presence at the court, OpenPlay rosters, GPS), not whether users sent a chat text before playing.

### The Expansionist
*Connected physical OpenPlay infrastructure with verification incentives:*
1. Leverage OpenPlay sessions: If two players attended the same 8-player pickup session at Halang, physical presence is verified.
2. Pair verification with community gamification: Award venue defense points toward the `👑 Home Court King` leaderboard upon confirmed wins.
3. Add positive-sum social endorsements (e.g. Fair Play, Great Rally) to turn verification into an engaging retention loop.

### The Outsider
*Highlighted UX friction and social intimidation:*
1. Terminology like "Dispute Audit" and "Co-verification" reads like a legal deposition.
2. Clicking a big red "Decline" button feels socially aggressive among community peers.
3. Notifications confined to the general activity feed get buried; prompts must appear in 1:1 chat.

### The Executor
*Proposed a 4-step engineering implementation:*
1. Introduce a 72-hour auto-resolution window (corroborated matches auto-verify; uncorroborated walk-ons expire to casual logs).
2. Add a `[ ✏️ Suggest Score Edit ]` counter-proposal mechanism.
3. Re-normalize formula weights dynamically when a match is marked as a walk-on pickup.
4. Deliver actionable verification cards directly into the 1:1 chat thread.

---

## 3. Round 2: Anonymous Peer Review Highlights

* **Consensus on the Walk-On Flaw**: All reviewers agreed that static weighting on $S_{\text{chat}}$ made walk-on dispute adjudication mathematically unviable.
* **Debate on Auto-Confirmation**: The Contrarian warned that an unconditional 72-hour timeout enables bad actors to log fake wins against inactive accounts. The Executor's proposal was revised to require physical OpenPlay or court co-attendance before auto-confirming.
* **Agreement on Counter-Proposals**: The First Principles and Executor recommendation for a 3-state action model (`Confirm`, `Suggest Edit`, `Contest`) received unanimous backing as the highest-impact UX fix.

---

## 4. Round 3: Real-World Scenario Matrix

| Scenario | Risk Under Old Architecture | Hardened Architectural Fix |
|---|---|---|
| **1. Sore Loser Veto** | Loser hits Decline; match auto-voids ($C < 0.70$). | If physical co-attendance exists, burden of proof shifts to challenger. |
| **2. Silent Ghosting** | Unresponsive opponent leaves match in limbo forever. | 72-hour window: auto-verifies if co-attendance exists; else cleanly archives as Casual Unverified. |
| **3. Honest Typo** | Score disagreement triggers heavy administrative audit. | 2-way counter-proposal: opponent suggests edit; author accepts with 1 tap. |
| **4. Spontaneous Walk-On** | $S_{\text{chat}} = 0$ prevents confidence score from reaching 0.70. | Dynamic weight re-normalization when match is tagged as a walk-on. |
| **5. Doubles 2v2 Split** | Partners split 2 vs 2 on match outcome. | Requires 3/4 consensus. If 2-2 tie, prompts partner review or voids without penalty. |
| **6. Newbie vs Veteran** | Veteran's higher trust score overrides legitimate newcomer win. | Trust differential clamped at $\pm 15\%$ maximum. |
| **7. Collusive Farming** | Players trade fake wins to farm Trust Quotient $T_u$. | 7-day rolling cap of 2 competitive rating updates between the same pair. |
| **8. Venue Mismatch** | False court tagging to steal Home Court Champion crown. | Venue points only awarded if mutual agreement or court check-in matches. |

---

## 5. Chairman Synthesis & Final Council Verdict

1. **Adopted Invariant**: Strict two-phase commit is maintained—unconfirmed matches strictly never increment competitive stats.
2. **Adopted UX Model**: Replace binary `Confirm/Decline` with the 3-state model (`Confirm ✓`, `Suggest Edit`, `Contest`).
3. **Adopted Formula**: Implement dynamic weight re-normalization ($w'$) for walk-on matches to eliminate the walk-on death spiral.
4. **Permanent Documentation**: Formalized into `docs/match-result-integrity-spec.md` and referenced in `HANDOFF.md`.
