# LLM Council: Suffix Input Design — Eliminating Pill Clutter While Maintaining Strict Normalization

**Date:** October 1, 2026  
**Topic:** How to replace the horizontal generational suffix pill row (`[ None | Jr. | Sr. | II | III | IV ]`) on Onboarding Step 0 to eliminate visual clutter without sacrificing strict input validation and database normalization.  
**Advisors:** The Contrarian, The Expansionist, The First Principles Thinker, The Outsider, The Executor  
**Peer Review Mode:** Double-blind peer review (5 independent peer evaluations)  

---

## 1. Context & Problem Statement

Following the transition to structured names (`firstName` and `lastName`), the onboarding registration screen introduced a horizontal pill row for generational suffixes (`[ None | Jr. | Sr. | II | III | IV ]`). 

The founder raised the core UX question:
> *"how can we make this strict input without cluttering with the pills?"*

### Options Evaluated
- **Option 1 (Inline 75/25 Split):** Place Last Name and Suffix side-by-side on one row (`[ Last Name (75%) ] [ Suffix None ▾ (25%) ]`).
- **Option 2 (Progressive Disclosure):** Clean two-field layout (`First Name`, `Last Name`) with a subtle `+ Add suffix (Jr., Sr., III)` toggle below Last Name.
- **Option 3 (Smart Auto-Detection):** Zero extra UI; user types their full name or surname in Last Name, and the app detects and strips the suffix on the fly into a pill badge.

---

## 2. Round 1: Autonomous Advisor Analyses

### The Contrarian
> **Pick: Option 2 (Progressive Disclosure).**
> Option 3 is a technical and UX landmine in React Native. Controlled `TextInput` components in React Native that mutate the typed string in real-time suffer from cursor-position jumps, IME/predictive text desync on Android, and keyboard jitter on backspace. If someone types "Dela Cruz Jr." and the string is silently sliced, backspacing becomes an infuriating trap.
>
> Option 1 fails on mobile viewports. On a 360px–390px phone (iPhone SE, budget Android), 25% horizontal width leaves barely 210px for Last Name. In the Philippines, compound surnames like *"de los Santos"*, *"del Rosario"*, and *"Concepcion-del Fierro"* will truncate horizontally. Worse, Option 1 forces 100% of users to navigate a permanent `None ▾` dropdown box to serve a 5% demographic edge case.
>
> Option 2 is the only sound choice. It keeps `lastName` at 100% width, avoids real-time string mutation, and hides the field until requested.

### The Expansionist
> **Pick: Option 3 (Smart Auto-Detection).**
> Forms should feel like magic, not tax documents. Auto-detecting generational suffixes (*"Dela Cruz Jr."* $\rightarrow$ chips off `[Jr.]` with a subtle haptic ping) turns a mundane onboarding chore into a signature product moment.
>
> Beyond onboarding, this parser becomes a shared engine asset for parsing tournament roster spreadsheets, GCash transaction names, and WhatsApp/Messenger chat registrations. Don't hide fields behind accordion clicks—build intelligent software.

### The First Principles Thinker
> **Pick: Option 2 (Progressive Disclosure).**
> What is the base rate? In the Philippines, generational suffixes apply to fewer than 5% of registrants (predominantly males named after fathers).
>
> Designing a form where a 5% exception occupies equal visual prominence or permanently steals 25% of horizontal screen real estate violates basic utility design. Option 1 penalizes 95% of users with visual noise. Option 3 introduces non-deterministic regex risk to solve a non-problem. 
>
> The first-principles solution is Progressive Disclosure: design the default path for the 95%, and provide an instant, frictionless path for the 5%.

### The Outsider
> **Pick: Option 2 (Progressive Disclosure).**
> Looking at the screen as an everyday player: I see First Name, Last Name, and then six buttons for something I don't have. It feels bureaucratic, like renewing a passport at DFA.
>
> Side-by-side dropdowns (Option 1) feel clunky and dated. Real-time text snatching (Option 3) feels like the app is interfering with my typing. 
>
> A neat little text link `+ Add suffix (Jr., Sr., etc.)` under Last Name is standard, polite, and completely removes the clutter. When tapped, it reveals the choices cleanly.

### The Executor
> **Pick: Option 2 (Progressive Disclosure).**
> Option 2 is zero-risk and can be shipped in under 15 minutes. It requires no complex regex parsers, has zero layout shift bugs across screen sizes, and keeps `lastName` at a full 100% width.
>
> Option 1 requires tricky flex styling and dropdown modal management on Android. Option 3 introduces test permutations for edge cases (*"King"*, *"Ali"*, *"Tan III"*). Option 2 delivers a spotless UI immediately.

---

## 3. Round 2: Double-Blind Peer Review

The 5 individual responses were anonymized and distributed across 5 independent peer reviewers:

| Reviewer | Strongest Argument | Biggest Blind Spot | Critical Catch Missed by All 5 |
| :--- | :--- | :--- | :--- |
| **Reviewer 1** | **Contrarian (Option 2)**: Rigorous React Native controlled input & 360px viewport breakdown. | **Expansionist (Option 3)**: Unchecked scope creep (GCash/rosters) ignoring client state corruption. | **Autofill & Edit Hydration:** Native OS autofill injects suffixes into `lastName`; edit screens must pre-expand if suffix exists. |
| **Reviewer 2** | **Contrarian (Option 2)**: Precise mobile failure modes (predictive text desync, cursor jumping). | **Expansionist (Option 3)**: Silent regex mutation strips user agency and causes backspace bugs. | **Muscle Memory Leakage:** Suffix bearers will instinctively type "Jr." into Last Name anyway, bypassing the collapsed trigger. |
| **Reviewer 3** | **Contrarian (Option 2)**: Direct platform-level critique of RN text inputs. | **Expansionist (Option 3)**: Treating UI state mutation as a "dopamine hit" without undo mechanics. | **Autofill & Dismissal UX:** Bundled autofill strings contaminate `lastName`; missing a clear way to collapse/remove if tapped. |
| **Reviewer 4** | **Contrarian (Option 2)**: Quantified 360px viewport penalty and exposed cursor jump traps. | **Expansionist (Option 3)**: Hallucinating omni-channel NLP while ignoring basic typing integrity. | **OS Autofill & Pre-hydration:** iOS/Android contact autofill routinely bypasses collapsed fields. |
| **Reviewer 5** | **Contrarian (Option 2)**: Sharpest technical critique of mobile input ergonomics. | **Expansionist (Option 3)**: Speculative feature creep over strict input normalization. | **Autofill Muscle Memory:** Need an `onBlur` guard to catch suffixes typed directly into `lastName`. |

---

## 4. Council Chairman Synthesis

### Where the Council Agrees
1. **Permanent Pills Must Go:** The horizontal row of 6 pills adds unacceptable visual noise to Onboarding Step 0 for a demographic feature relevant to <5% of players.
2. **Option 1 (Inline 75/25 Split) is a Viewport Failure:** On standard 360px–390px mobile screens, stealing 25% of the row cramps compound Philippine surnames (*"de los Santos"*, *"del Rosario"*).
3. **Option 3 (Real-Time Keystroke Auto-Detection) is Technically Unstable:** Controlled string mutations in React Native during `onChangeText` trigger cursor jumping, predictive text fighting, and backspace lockups.
4. **Option 2 (Progressive Disclosure) is the Decisive UX Foundation:** Clean, predictable, full-width, and eliminates 100% of clutter for the 95% majority.

### The Breakthrough Blind Spot Caught in Peer Review
All 5 peer reviewers caught the exact vulnerability of a naive Option 2 implementation:
- **The Autofill & Muscle Memory Gap:** Suffix bearers (or mobile OS contact autofill on iOS/Android) will habitually type or paste `"Dela Cruz Jr."` directly into the `lastName` input.
- If Option 2 relies *solely* on a manual tap of `+ Add suffix`, these users will never tap the link. The database would end up storing `lastName: "Dela Cruz Jr."` and `suffix: null`, quietly defeating the user's requirement for strict, normalized input!

### The Solution: "Progressive Disclosure with `onBlur` Autofill Guard" (Option 2 + Guard)
We combine the clean UI of Option 2 with the intelligent parsing of Option 3, but executed **strictly on blur / autofill**, completely eliminating typing cursor-jump bugs:

```
[ Default State - 95% of Users ]
First Name: [ Mark Anthony                    ]
Last Name:  [ Dela Cruz                       ]
            + Add suffix (Jr., Sr., III)      <-- Subtle, elegant text button

[ Expanded State (Manual Tap OR Blur/Autofill Guard) ]
First Name: [ Mark Anthony                    ]
Last Name:  [ Dela Cruz                       ]
Suffix:     [ Jr. ]  [ Sr. ]  [ II ]  [ III ]  [ IV ]  [ ✕ Remove ]
```

1. **Default Clean View:** Only `First Name` and `Last Name` (100% width) are rendered, plus the subtle `+ Add suffix` trigger. Zero pills cluttering the screen.
2. **On Tap `+ Add suffix`:** Expands the compact suffix picker with standard options and a `✕ Remove` button to re-collapse.
3. **`onBlur` Autofill & Muscle Memory Guard:**
   - When the user leaves the `Last Name` field (or autofill populates it), the system checks if the trailing word is a valid suffix (e.g. `"Dela Cruz Jr."` or `"Reyes III"`).
   - If matched: It automatically extracts the suffix, trims `lastName` to `"Dela Cruz"`, sets `suffix = "Jr."`, and reveals the picker with `Jr.` highlighted.
   - Because this occurs on `onBlur` or submission, **zero cursor-jumping or typing glitches occur**.
4. **Hydration / Edit Mode:** If an existing profile record already has a non-null `suffix`, the field automatically mounts in the expanded state.

---

## 5. Council Recommendation & Action Plan

- **Verdict:** Implement **Progressive Disclosure with `onBlur` Autofill Guard**.
- **The One Thing to Do First:** Update `src/app/onboarding.tsx` to hide the suffix pills behind the `+ Add suffix (Jr., Sr., III)` toggle, add the `onBlur` suffix extraction guard to the `Last Name` input, and include an inline `✕ Remove` option.
