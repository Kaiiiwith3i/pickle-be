# LLM Council Transcript: Structured Name Breakdown (First, Last, Suffix & Court Nickname)
**Date**: October 1, 2026  
**Methodology**: Karpathy-Style LLM Council (5 Autonomous Thinking Lenses + Anonymous Peer Review + Chairman Synthesis)  
**Topic**: Breaking down Full Name into First Name, Last Name, and related fields for data consistency  
**Status**: Adopted & Formalized into Specification  

---

## 1. Framed Council Prompt

**Question**: *For the Full Name field, the founder wants it broken down into First Name, Last Name, and other related fields for consistency of data input. How should this schema be structured to achieve true data consistency without turning onboarding into a bureaucratic census form or breaking Philippine cultural naming norms?*

**System & Regional Context**:
- **App Domain**: Pickle C-LB, hyperlocal community pickleball app for Calamba & Los Baños, Laguna.
- **Client & Engine Invariants**: React Native (Expo SDK 52) Step 0 onboarding; `packages/engine` and Firestore expect `displayName: string` across leaderboards, match cards, chat, and ratings; unique `@username: string` handle.
- **Philippine Cultural Realities**:
  * Given Names: Frequently compound (*"Mary Grace"*, *"John Paul"*, *"Mark Anthony"*).
  * Middle Name: Legally defined as maternal maiden surname (*"Mercado"*, *"Reyes"*), distinct from Western second given names.
  * Last Name / Surname: Frequently Spanish/compound (*"Dela Cruz"*, *"Del Rosario"*, *"San Juan"*, *"de los Reyes"*).
  * Suffixes: Generational (*"Jr."*, *"Sr."*, *"II"*, *"III"*), common for distinguishing fathers and sons playing in the same local club.
  * Court Call Names: Honorifics and casual monikers (*"Coach Kiel"*, *"Kuya Bong"*, *"Doc Liza"*).

---

## 2. Round 1: Autonomous Advisor Perspectives

### The Contrarian (Response B)
- **The Core Flaw**: Atomizing name fields in the Philippines creates dirty data, not consistency.
- **The Middle Name Trap**: Asking for "Middle Name" causes half of users to enter their second given name (*"Paul"* from *"John Paul"*) and the other half their mother's maiden surname (*"Mercado"*). Validation cannot distinguish them.
- **Compound Surnames**: Prefixes (*"de los"*, *"San"*, *"Dela"*) get mangled or split across boxes.
- **Recommendation**: Step 0 should only collect social display name; collect civil fields strictly *just-in-time* during tournament checkout.

### The First Principles Thinker (Response E)
- **Deconstructing the Requirement**: Two fundamental operational realities exist:
  1. *Court Recognition*: "Who am I playing with?" (*"Kuya Bong"*, *"Doc Liza"*)
  2. *Roster Sortability*: "Who is in this bracket?" (*"Dela Cruz, Juan"*)
- **Schema**:
  * `givenNames` (Mandatory, e.g. "Mary Grace", "John Paul")
  * `lastName` (Mandatory, e.g. "Dela Cruz", "San Juan")
  * `courtName` (Optional, defaults to first word of givenNames)
- Drop Middle Name and Suffix from onboarding entirely. Collect maternal surnames at tournament check-in.

### The Expansionist (Response C)
- **Dual-Track Identity**: Elevate names into a tournament and commercial asset:
  * First Name (Mandatory)
  * Last Name (Mandatory)
  * Court Call Name / Moniker (Mandatory): Drives community virality and PA callouts (*"Now serving on Court 2: Kuya Bong"*).
  * Middle Name (Optional / Progressive): For tournament sanctioning.
  * Suffix (Optional dropdown): Jr., Sr., II, III.
- **Upside**: GCash/Maya KYC cash prize matching, DUPR & National League export readiness.
- Auto-compute `displayName` as `[CourtCallName] [LastInitial.]` (*"Coach Kiel S."*).

### The Outsider (Response A)
- **NBI Clearance Syndrome**: Why does a pickup sports app feel like a government census? Extra fields guarantee drop-off.
- **Minimal 3-Field Schema**:
  * First / Given Name (Mandatory)
  * Last / Surname (Mandatory)
  * Court Nickname (Optional, e.g. "Doc Liza", "Kuya Bong")
- Stack vertically (never side-by-side) to prevent clipping long Filipino names.
- Eliminating "Middle Name" eliminates 90% of user hesitation and bad data.

### The Executor (Response D)
- **Production-Ready 4-Field Architecture**:
  * `firstName` (Given Name, Mandatory, min 2 chars)
  * `lastName` (Surname, Mandatory, min 2 chars)
  * `suffix` (Optional: Horizontal segmented pills `None`, `Jr.`, `Sr.`, `III` — zero keyboard popup)
  * `nickname` (Optional Court Call Name: "Kuya Bong", "Doc Liza")
- **Mobile Ergonomics**: Wrapped in `KeyboardAwareScrollView`. Field 1: First Name, Field 2: Last Name, Row 3: Suffix pills, Field 4: Optional Court Call Name. Total input time < 12 seconds.
- **Auto-Computation**:
  * `displayName`: `${nickname ? nickname : firstName} ${lastName}${suffix ? ' ' + suffix : ''}`
  * `@username`: lowercase alphanumeric slug of `${firstName}${lastName}` with collision counter.
  * Preserves 100% backward compatibility with `packages/engine` and Firestore.

---

## 3. Round 2: Anonymous Peer Review Highlights

All 5 peer reviewers evaluated Responses A through E:

- **Strongest Response**: **Response D (The Executor)** was unanimously rated #1 by all 5 reviewers (5/5). Reviewers praised its concrete mobile ergonomics (horizontal suffix pills with zero keyboard thrash), immediate deletion of the confusing Middle Name, and strict compatibility with `packages/engine`.
- **Biggest Blind Spot**: **Response C (The Expansionist)** was unanimously identified as having the biggest blind spot (5/5). Reviewers noted that making Court Call Name mandatory creates immediate onboarding paralysis for newcomers who lack a moniker, and abbreviating surnames to an initial (*"Coach Kiel S."*) causes catastrophic name collisions in local barangay tournaments.
- **Universal Blind Spots Identified by Peer Reviewers**:
  1. *Legacy Data Migration & Runtime Fallback*: The existing database stores single-string `displayName` records. The system must support `user.displayName ?? `${user.firstName} ${user.lastName}`` so existing players never encounter crashes.
  2. *Firestore Search Indexing*: Splitting names breaks basic substring queries across multiple fields. A computed `searchKeywords` array or indexed lowercase `displayName` must be maintained.
  3. *Filipino Diacritics ("ñ" and accents)*: Surnames like *Castañeda*, *Niño*, and *Peña* must be normalized to ASCII (*castaneda*, *nino*, *pena*) when generating `@username` slugs.

---

## 4. Council Synthesis & Verdict

### Where the Council Agrees
1. **Banish "Middle Name" from Onboarding Step 0 (Unanimous 5-0)**: In the Philippines, Middle Name is the mother's maiden surname. Asking for it during casual onboarding causes confusion with second given names, user hesitation, and bad data. Middle Name belongs strictly in an event-specific tournament waiver or KYC modal.
2. **The Core Mandatory Pair**: `firstName` (Given Name, min 2 chars) and `lastName` (Surname, min 2 chars) are the only mandatory inputs.
3. **Court Recognition is Vital**: An optional `nickname` / Court Call Name (*"Coach Kiel"*, *"Kuya Bong"*, *"Doc Liza"*) must be supported so community identity is not erased by civil registration names.
4. **Mobile Layout Constraints**: Inputs must be stacked full-width vertically. Placing First and Last Name side-by-side clips long Philippine compound names (*"Mary Antoinette"*, *"de los Santos"*).
5. **Zero Breaking Changes for the Engine**: The system must auto-derive `displayName: string` at submission time to maintain 100% compatibility with `packages/engine`, Firestore, match logging cards, and 1:1 chat.

### Where the Council Clashes
- **Suffix Handling**: Outsider and First Principles suggested dropping Suffix to keep inputs minimal. The Executor demonstrated that in Philippine sports, distinguishing fathers and sons (*"Jr."*, *"III"*) is essential, and implemented it as a **horizontal segmented tap pill row** (`None`, `Jr.`, `Sr.`, `III`), which requires zero keyboard popups and takes zero vertical typing effort.
- **Mandatory vs. Optional Court Call Name**: The Expansionist wanted Court Call Name mandatory to build brand virality. The remaining advisors and all 5 reviewers decisively rejected this because newcomers and beginners do not have a moniker yet. It must remain strictly optional.

### Blind Spots the Council Caught
1. **The "Middle Name Trap"**: Asking for "Middle Name" without legal context ruins data consistency in the Philippines.
2. **Legacy User Fallback**: Unmigrated users in Firestore must gracefully render via runtime fallback `displayName ?? `${firstName} ${lastName}``.
3. **Firestore Search Preservation**: The system must preserve an indexed `displayName` and search array to allow unified searching without expensive multi-field index combos.
4. **Diacritic Normalization**: Surnames with *"ñ"* (*Castañeda*, *Peña*) must be normalized during `@username` generation.

### The Recommendation
Adopt the **Pragmatic 3+1 Structured Name Model** for Step 0 Onboarding:

1. **Form Schema**:
   - `firstName` (*Mandatory*): Given Name(s) (e.g., *"John Paul"*, *"Mary Grace"*)
   - `lastName` (*Mandatory*): Family Name / Surname (e.g., *"Dela Cruz"*, *"San Juan"*)
   - `suffix` (*Optional*): Generational Suffix via single-tap segmented pills (`None`, `Jr.`, `Sr.`, `III`, `IV`)
   - `nickname` (*Optional*): Court Call Name (e.g., *"Coach Kiel"*, *"Kuya Bong"*)
   - *(Middle Name is explicitly excluded from Step 0 and reserved for tournament verification)*
2. **Auto-Computation**:
   - `displayName`: `${nickname ? nickname : firstName} ${lastName}${suffix && suffix !== 'None' ? ' ' + suffix : ''}`
   - `@username`: Auto-suggested slug `${firstName}_${lastName}` with accent normalization (`.normalize("NFD").replace(/[\u0300-\u036f]/g, "")`) and collision counter.
   - `tournamentRosterName`: `${lastName}, ${firstName}${suffix && suffix !== 'None' ? ' ' + suffix : ''}`
3. **Ergonomics**: Wrapped in `KeyboardAwareScrollView`, vertically stacked full-width inputs, `.trim()` and Title Case on blur.

### The One Thing You Should Do First
Review and approve the 3+1 field schema specification before implementing the UI changes on Step 0.
