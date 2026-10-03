# LLM Council Transcript: Normalizing Full Name vs. Splitting into First & Last Name
**Date**: September 29, 2026  
**Methodology**: Karpathy-Style LLM Council (5 Autonomous Thinking Lenses + Anonymous Peer Review + Chairman Synthesis)  
**Topic**: Should Pickle C-LB replace the single `Full Name` onboarding field with separate `First Name` (`fname`) and `Last Name` (`lname`) inputs?  
**Status**: Adopted & Formalized (Proposal Rejected; Progressive Profiling with Unified Full Name Preserved)  

---

## 1. Framed Council Prompt

**Question**: *Should Pickle C-LB normalize the user's Full Name by breaking it down into separate First Name (`fname`) and Last Name (`lname`) input fields during onboarding registration, or keep a single unified Full Name field?*

**System & Regional Context**:
- **Hyperlocal Domain**: Pickleball community in Calamba & Los Baños (Laguna, Philippines).
- **Current Architecture**: Single shared TypeScript engine (`packages/engine`), Firestore users collection with `displayName: string`, and a recently added unique `@username` handle and normalized title-casing.
- **Cultural Naming Norms**: Philippine naming conventions feature widespread compound given names (*"Mary Grace"*, *"John Paul"*, *"Mark Anthony"*), Spanish particles and compound surnames (*"Dela Cruz"*, *"Del Rosario"*, *"de los Reyes"*, *"San Juan"*), maternal middle names, and informal court call names (*"Coach Kiel"*, *"Kuya Bong"*).
- **Core Tensions**: User onboarding friction vs. structured database fields; DUPR/tournament bracket export vs. community pickup social recognition.

---

## 2. Round 1: Autonomous Advisor Perspectives

### The Contrarian (Strong NO)
Splitting full name into two fields adds unnecessary friction to solve a problem that does not exist.
1. **Compound Name Disaster**: In the Philippines, compound first names (*"John Paul"*, *"Mary Grace"*) and compound surnames (*"Dela Cruz"*, *"Del Rosario"*) are ubiquitous. Splitting them into rigid text boxes introduces ambiguity and dirty data at the point of entry. Users freeze wondering: does *"Dela"* go into the first name or last name?
2. **Onboarding Drop-off**: Every additional text input on mobile increases bounce rate. Mobile users hate filling forms under the sun beside a court.
3. **Architectural Theater**: If the backend, chat, leaderboards, and recommendation engine consume a single `displayName: string`, forcing the user to split their name only for the client to immediately re-concatenate it (`${fname} ${lname}`) is pure architectural waste.

### The First Principles Thinker (Strong NO)
Why do computer systems split names? It is an Anglo-Western bureaucratic artifact invented for telephone directories, postal mailings, and relational databases in the 1970s.
1. **Social Recognition vs. Civil Registry**: On a pickleball court in Laguna, nobody cares about sorting by paternal surname. Players recognize each other by how they are called: *"Coach Kiel"*, *"Tito Bong"*, *"Mary Grace"*.
2. **Uniqueness is Already Solved**: Uniqueness and system routing are handled by the unique user ID (`uid`) and the newly introduced dedicated `@username` handle. The display name is purely a human-facing social label.
3. **Wrong Primitive**: A name is a continuous string of cultural self-identification, not a binary tuple.

### The Expansionist (YES)
Looking down the road, structured identity unlocks significant competitive and enterprise capability:
1. **Tournament Brackets & Seedings**: Official sports federations (PPA, APP, DUPR, UTR) index and seed players strictly by `Last Name, First Name`. Parsing an unformatted string breaks automated bracket generators.
2. **Broadcast & Scoreboard Overlays**: Live streams and court displays need compact shorthand (*"Navasero / Del Rosario"* or *"K. Navasero"*), which requires knowing the surname.
3. **Gated Venue Access & Clan Rivalries**: Private resort courts in Pansol and gated subdivisions require security manifests with formal surnames. Furthermore, local rivalry tracking thrives on family dynasties.
4. **Personalized Notifications**: Engaging push alerts (*"Kiel, your 6 PM court is waiting"*) require an isolated given name.

### The Outsider (Strong NO)
Fresh eyes see immediate, unnecessary developer friction:
1. **Developer Bookkeeping Shifted to Users**: When an app asks for First Name and Last Name, it is forcing the user to do database normalization work that benefits nobody on court.
2. **Internationalization Failure**: Falsehoods Programmers Believe About Names: not everyone has a first and last name, and millions of Filipinos have multiline or compound Spanish surnames.
3. **Keep It Simple**: Ask for the name the player wants to be called. That is all a recreational community needs.

### The Executor (Strong NO)
Look at Monday morning execution and technical reality:
1. **The Backfill Nightmare**: The app already has registered users in mock/JSON/Firestore. Writing a heuristic migration script to backfill existing full names like *"Mary Grace Del Rosario"* into `fname` and `lname` is algorithmic suicide.
2. **Schema & Engine Churn**: The shared package (`packages/engine`) and client screens use `displayName`. Splitting into `fname` and `lname` requires schema migrations, interface updates, and zero actual gameplay benefit.
3. **Pragmatic Compromise**: If greetings require a first name, tokenize the first space (`fullName.split(' ')[0]`). If formal identity is ever needed, put an optional *"Preferred Name"* or *"Legal Name"* in Profile Settings, never on the front door.

---

## 3. Round 2: Anonymous Peer Review Highlights

Each advisor evaluated all 5 anonymized responses (Response A through E):

- **Reviewer 1**:
  - *Strongest*: **Response D (First Principles)** — Cut through dogma: community sports identity is social recognition, not civil bookkeeping.
  - *Biggest Blind Spot*: **Response A (Expansionist)** — Missed that Philippine government ID verification legally mandates the **maternal middle name**; an Anglo-Western 2-field model fails legal verification anyway.
  - *Missed by All*: **Progressive Profiling** (capture formal legal names just-in-time for sanctioned tournaments, not at onboarding).

- **Reviewer 2**:
  - *Strongest*: **Response D (First Principles)** — Correctly identified `@handle` as resolving uniqueness while backend only consumes `displayName`.
  - *Biggest Blind Spot*: **Response A (Expansionist)** — Chased enterprise fantasies (DUPR, security manifests) at top-of-funnel onboarding.
  - *Missed by All*: **Tripartite Philippine Naming Standards** (Given Name, Maternal Surname, Paternal Surname, Suffix).

- **Reviewer 3**:
  - *Strongest*: **Response C (Executor)** — Grounded the decision in real operational engineering: backfilling compound names corrupts data, and splitting to re-concatenate is architectural churn.
  - *Biggest Blind Spot*: **Response A (Expansionist)** — Premature optimization for edge-case tournaments.
  - *Missed by All*: **The Two-Field Trap** (worst of both worlds: too rigid for casual pickup, yet legally inadequate for Philippine KYC).

- **Reviewer 4**:
  - *Strongest*: **Response D (First Principles)** — Dismantled the premise: split names are an Anglo-Western bureaucratic relic.
  - *Biggest Blind Spot*: **Response A (Expansionist)** — Forcing rigid two-box inputs guarantees onboarding drop-off.
  - *Missed by All*: **Just-in-Time Identity Capture** via event-specific waivers or tournament check-ins.

- **Reviewer 5**:
  - *Strongest*: **Response C (Executor)** — Highlighted that re-concatenating `${fname} ${lname}` for `displayName` is pure waste.
  - *Biggest Blind Spot*: **Response A (Expansionist)** — Two fields produce the exact dirty data it claims to eliminate when users struggle with compound names.
  - *Missed by All*: **Federated / Social Auth** (Apple/Google Sign-In captures names natively without user typing friction).

---

## 4. Council Synthesis & Verdict

### Where the Council Agrees
1. **The Single Field is Superior for Onboarding**: 4 out of 5 advisors and 5 out of 5 peer reviews firmly concluded that splitting Full Name into `fname` and `lname` on Onboarding Step 0 creates severe UX friction, increases mobile abandonment, and mangles ubiquitous Philippine compound names (*"Mary Grace"*, *"Dela Cruz"*).
2. **Architectural Churn**: The shared engine (`@engine`), Firestore database, and app UI (chat, match cards, corridor leaderboards) consume a single `displayName: string`. Splitting into two input boxes on client onboarding only to immediately re-concatenate them as `${fname} ${lname}` is architectural theater.
3. **Identity Uniqueness is Already Handled**: With the introduction of the `@username` handle and internal `uid`, the display name is strictly a social recognition label on court, not a unique database key.

### Where the Council Clashes
- **Immediate Simplicity vs. Future Tournament/DUPR Ambitions**: The Expansionist made a compelling case for structured names in competitive contexts (official DUPR exports, broadcast graphics like *"Navasero / Del Rosario"*, gate manifests in private Pansol resorts).
- **The Resolution**: The clash was resolved through the peer reviews: the Expansionist’s goals are valid, but **Onboarding Step 0 is the wrong time and place to collect them**.

### Blind Spots the Council Caught
1. **The "Two-Field Trap" in the Philippines**: An Anglo-Western binary split (`fname` + `lname`) is the worst of both worlds. It introduces friction and cognitive confusion for casual players, yet remains legally and administratively useless for formal Philippine sports federations or government ID verification—which legally require **Given Name, Maternal Middle Name, Surname, and Suffix**.
2. **Progressive Profiling**: Identity capture is not an all-or-nothing onboarding dilemma. Casual pickup registration requires minimal friction (`Full Name` + `@username`). When a player registers for an official DUPR-sanctioned prize tournament or enters a gated subdivision venue, structured legal identity should be requested *just-in-time* via tournament registration or Profile Settings.
3. **Data Backfill Impossibility**: Existing users with single display names cannot be deterministically split by algorithm without corrupting compound names.

### The Recommendation
**REJECT the proposal to split Full Name into `fname` and `lname` on Onboarding Step 0.**

1. **Keep Onboarding Step 0 as a Single Clean Input**: Retain the single `Full Name` field. It is already enhanced with Title Case normalization (`normalizeFullName`) and automatic `@username` generation (`suggestUsername`).
2. **Derive Call Names Naturally**: If push notifications or informal UI greetings require a first name, tokenize the first word (`fullName.trim().split(/\s+/)[0]`) or provide an optional *"Preferred Name / Nickname"* field in Profile Settings.
3. **Defer Structured Legal Identity to Progressive Profiling**: When formal DUPR export or tournament bracket seeding features are built, collect formal legal names (Given, Middle, Surname, Suffix) as an event-specific requirement, not as a barrier to initial app onboarding.

### The One Thing You Should Do First
**Lock the current onboarding identity contract as `fullName` -> normalized `displayName` + `@username`, and keep Onboarding Step 0 frictionless.**
