# Match Result Consistency & Integrity Specification
## Decentralized Ground-Truth & Anti-Tampering Framework

> **Documentation Hub**: [README](../README.md) · [Master Specification](../propose_enhancement.md) · [Changelog](../CHANGELOG.md) · [Release Notes](../TODAYS_CHANGES.md) · [Handoff](../HANDOFF.md) · [Council Decision](councils/2026-09-12-match-result-integrity.md)

**Project**: Pickle C-LB (Calamba & Los Baños Pickleball Community Platform)  
**Authors**: Cortez, Navasero (Kiel), Ordoñez (City College of Calamba)  
**Date**: September 12–13, 2026  
**Status**: Formal Architectural Standard — Production Ready  

---

## 1. Executive Summary & The Ground-Truth Dilemma

Recreational pickleball in community corridors like Calamba and Los Baños lacks paid referees, electronic court gates, and centralized scorekeepers. Left unchecked, self-reported match result logging in mobile apps suffers from four critical threats:

1. **Asymmetric / Phantom Wins**: Player A logs an unplayed or fabricated win against Player B to inflate their win-rate.
2. **The "Sore Loser Veto"**: Player B legitimately loses an intense 3-set match, but refuses to confirm or maliciously disputes it, robbing Player A of their earned standing.
3. **Scoreline Typo Escalation**: Honest memory differences (e.g., `11-9` vs `11-7`) force binary disputes, triggering administrative overhead for simple clerical errors.
4. **The Casual Walk-On Bias**: Unscheduled pickup games lack in-app chat proposals, causing rigid verification algorithms to treat legitimate physical matches as suspicious.

To resolve these without bureaucratic friction, **Pickle C-LB implements a 5-Layer Mathematical and Behavioral Verification Architecture** governed by strict data invariants.

---

## 2. Core Architectural Invariants

| Invariant | Implementation | Rationale |
|---|---|---|
| **Two-Phase Commit (Staged Gate)** | Unconfirmed matches (`confirmed: false`) NEVER increment wins, win rates, or leaderboard standings. | Eliminates phantom win accumulation. An author logging 50 unconfirmed matches receives 0 wins. |
| **3-State Verification Action** | Verification prompts provide `[ Confirm ✓ ]`, `[ ✏️ Suggest Edit ]`, and `[ ❌ Contest ]`. | Disentangles clerical scoreline typos from malicious fraud. |
| **Walk-On Weight Re-normalization** | When no prior in-chat booking exists ($S_{\text{chat}} = 0$), weight is dynamically reallocated across physical attendance and proof. | Prevents spontaneous pickup games from falling into the "Walk-On Death Spiral". |
| **Collusion Throttling** | Repeat head-to-head matches between the same two players cap at **2 competitive rating updates per 7 days**. | Prevents Sybil win-trading circles from farming the Community Trust Quotient ($T_u$). |
| **Boost-Only CF Safety** | Engine invariant: $S = \text{content} + w \cdot \text{cfSim} \cdot (1 - \text{content})$. | Behavioral match history can only *boost* match recommendations; it can never override Stage 1 skill tier safety ($|\Delta\text{tier}| \le 1$). |

---

## 3. End-to-End Match Lifecycle

```
[QuickMatchLoggerModal]
        │ (Phase 1: Staged Claim: confirmed=false, disputed=false)
        ▼
[1:1 Chat Message & Activity Feed] ─── (Pending Opponent Action) ───► [Career Stats & Leaderboards]
        │                                                                        │
        ├─────────────────────────────┬──────────────────────────────┐           │ (Strict Invariant:
        ▼                             ▼                              ▼           │  ZERO stats impact
[Action A: Confirm ✓]     [Action B: Suggest Edit]       [Action C: Contest]     │  until agreement)
        │                             │                              │           │
        │ (confirmed=true)            ▼ (Counter-Score)              │           │
        │                 [Author Accepts Correction?]               │           │
        │                      ├───────────────┐                     │           │
        │                    (Yes)            (No)                   │           │
        │                      │               │                     │           │
        │                      ▼               ▼                     │           │
        │            [Update Scoreline]  [Unresolved]                │           │
        │                      │               │                     │           │
        ▼                      ▼               ▼                     ▼           │
 [Verified Match Result]               [5-Layer Dispute Auditor] ────────────────┤
        │                                      │                                 │
        ▼                                      ▼ (C >= 0.70 / C < 0.70)          ▼
 [Career Stats & Ratings Updated]      [Verified / Void Match] ──────────► [Official Ratings]
```

---

## 4. The 3-State Verification Flow

Opponents receive an actionable prompt directly in their **1:1 Chat Thread** and on the **Community Feed**:

1. **`[ Confirm ✓ ]` (Mutual Agreement)**:
   * Sets `confirmed: true`, `disputed: false`.
   * Immediately updates both players' career records, win rates, head-to-head records, and court-specific standings (`courtRecords`).
2. **`[ ✏️ Suggest Score Edit ]` (Negotiation / Typo Resolution)**:
   * Opponent submits their remembered scoreline (e.g. `11-9 · 11-8`).
   * The author receives a 1-tap `[ Accept New Score ]` prompt in their chat thread.
   * If accepted: updates scoreline and marks `confirmed: true` with zero dispute penalties.
3. **`[ ❌ Contest / Did Not Play ]` (Fraud / Denial Escalation)**:
   * Sets `disputed: true`.
   * Escalates to the **5-Layer Mathematical Truth Verification Engine**.

---

## 5. Mathematical Truth Verification Engine

When a match is contested, Pickle C-LB evaluates the claim via deterministic mathematical scoring ($< 1\text{ ms}$ on-device execution):

$$\text{Confidence } (C) = w_{\text{chat}} \cdot S_{\text{chat}} + w_{\text{trust}} \cdot \left(\frac{T_{\text{author}}}{T_{\text{author}} + T_{\text{opp}}}\right) + w_{\text{consensus}} \cdot S_{\text{consensus}} + w_{\text{proof}} \cdot S_{\text{proof}}$$

### Dynamic Weight Re-normalization (Solving the Walk-On Problem)

Standard matches with in-app chat bookings use baseline weights. When a match is flagged as an unscheduled court walk-on, weights automatically re-normalize:

| Signal | Baseline Weight ($w$) | Walk-On Re-normalized ($w'$) | Evaluation Method |
|---|---|---|---|
| **$S_{\text{chat}}$ (In-Chat Proposal)** | **0.35** | **0.00** | Proves match was scheduled via in-app proposal for that date/court. |
| **$S_{\text{presence}}$ (Co-Location / OpenPlay)** | **0.00** | **0.40** | Proves both players were verified attendees of the same OpenPlay session or court check-in. |
| **$T_u$ (Trust Differential)** | **0.35** | **0.35** | Ratio of author's Trust Quotient vs opponent's Trust Quotient (capped at $\pm 15\%$). |
| **$S_{\text{consensus}}$ (Doubles Majority)** | **0.20** | **0.15** | In 2v2 doubles, checks if $\ge 3$ of 4 players corroborate the scoreline. |
| **$S_{\text{proof}}$ (Physical Proof)** | **0.10** | **0.10** | Whiteboard photo or caretaker log confirmation. |

---

## 6. Player Community Trust Quotient ($T_u$)

Each player holds a dynamic trust score:

$$T_u = \left(\frac{\text{Confirmed Matches}}{\max(1, \text{Total Logged Matches})}\right) \times (1 - \text{Dispute Rate})$$

* **High-Trust Veteran** ($T_u \ge 0.85$, $\ge 3$ matches): Score claims carry strong credibility.
* **Moderate Player** ($0.60 \le T_u < 0.85$): Baseline community participant.
* **Flagged / Review** ($T_u < 0.60$ or Dispute Rate $\ge 40\%$): Score logging privileges restricted; claims require mandatory photo or doubles consensus.

---

## 7. Expanded Real-World Failure Scenarios & Defenses

### Scenario 1: The Sore Loser Veto (Malicious Denial)
* **Problem**: Player A wins a hard-fought walk-on game. Player B is angry and clicks `Contest`.
* **Defense**: If Player A and Player B have physical co-attendance (e.g. OpenPlay session check-in), $S_{\text{presence}} = 1.0$. Combined with Player A's clean Trust Quotient ($T_a \ge 0.85$), confidence clears $C \ge 0.70$. Player B's dispute rate increases, lowering their future trust score.

### Scenario 2: The Silent Ghost (Opponent Inactivity)
* **Problem**: Opponent plays, goes home, and never opens the app again.
* **Defense**: **72-Hour Auto-Resolution Window**:
  * *If corroborated by OpenPlay roster or GPS court check-in*: Auto-confirms as verified after 72 hours.
  * *If uncorroborated walk-on*: Auto-expires cleanly into a "Casual Unverified" personal log (visible on author's profile, but excluded from competitive rankings).

### Scenario 3: The Honest Typo / Partial Agreement
* **Problem**: Player A won 11-9, but mistyped 11-7. Player B rejects 11-7.
* **Defense**: Handled seamlessly by `[ ✏️ Suggest Score Edit ]`. Player B inputs 11-9; Player A accepts with 1 tap. Zero disputes logged.

### Scenario 4: Doubles 2v2 Split (Partner Deadlock)
* **Problem**: In a doubles match, Team A claims win; Team B claims win. Neither team has a 3/4 majority ($S_{\text{consensus}} = 0.50$).
* **Defense**: The engine detects a 2-2 deadlock. Prompts players to confirm whether the match was a practice rally or sanctioned game. If unresolved, the **Layer 5 Inconclusive Fail-Safe** voids the match with zero rating penalties.

### Scenario 5: Newbie vs Veteran Asymmetry
* **Problem**: A new player ($T_{\text{new}} = 0.75$) legitimately beats a veteran ($T_{\text{vet}} = 0.95$). If the veteran disputes, the raw trust ratio would unfairly penalize the new player.
* **Defense**: **Trust Differential Clamping**: Trust ratio impact is capped at a maximum $\pm 15\%$ differential, ensuring veteran status can never act as a veto against legitimate losses.

### Scenario 6: Collusive Win-Trading Circle
* **Problem**: Two players swap 20 fake wins at Mayapa Covered Court to artificially inflate ratings and farm the `👑 Home Court King` badge.
* **Defense**:
  1. **7-Day H2H Cap**: Only 2 competitive matches between the same pair count toward rating updates per 7-day rolling window.
  2. **Boost-Only Invariant**: Behavioral history can never override Stage 1 skill tier limits ($|\Delta\text{tier}| \le 1$).

---

## 8. Verification & Test Evidence

* Automated unit tests in [`scripts/__tests__/stats.test.ts`](../scripts/__tests__/stats.test.ts) enforce that unconfirmed or disputed matches strictly never inflate career statistics or leaderboard rankings.
* Automated dispute audits in [`scripts/__tests__/dispute-audit.test.ts`](../scripts/__tests__/dispute-audit.test.ts) verify the 5-layer scoring thresholds and Layer 5 voiding fail-safe.
