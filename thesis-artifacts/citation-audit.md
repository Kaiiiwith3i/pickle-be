# Pickle C-LB Manuscript — Citation Audit (2026-07-11)

Every reference in `Thesis Paper chap123 rev.pdf` was verified against the
open literature. **Verdicts**: KEEP (verified, correctly used) · FIX (real
work, but miscited or misquoted) · REPLACE (could not be verified to exist —
treated as fabricated and replaced with real literature) · DROP (never cited
in text, or redundant after replacement).

## Fabricated / unverifiable — REPLACED

| Old ref | Problem | Replacement (verified) | Dependent claim rewrite |
|---|---|---|---|
| [21] Bilen & Alankus 2020, IEEE CoG | No such paper found | C. Yuksel, "Skill-Based Matchmaking for Competitive Two-Player Games," *Proc. ACM Comput. Graph. Interact. Tech.* 7(1), 2024, doi:10.1145/3651303 · R. Herbrich, T. Minka, T. Graepel, "TrueSkill: A Bayesian Skill Rating System," *NIPS 19*, 2007 | Drop invented "F1 > 0.80" finding; cite rating-based pairing as the established mechanism for balanced two-player matches |
| [23] Tan et al. 2019 (ActiveSG, "68%") | No such study | M. Csikszentmihalyi, *Flow*, Harper & Row, 1990 (challenge–skill balance) · Z. Chen et al., "EOMM: An Engagement Optimized Matchmaking Framework," *WWW '17* | Skill-mismatch → disengagement grounded in flow theory + empirical matchmaking-engagement literature; remove invented percentage |
| [27] Kwon & Park 2021, IJHCS ("85% reduction") | No such paper | I. Junglas & R. Watson, "Location-Based Services," *CACM* 51(3), 2008 · H. Huang et al., "Location Based Services: Ongoing Evolution and Research Agenda," *J. Location Based Serv.*, 2018 | Map-based discovery reduces search friction (qualitative LBS literature); remove invented 85%/12.4-min figures |
| [28] Reyes et al. 2022 ("J. Comput. Inf. Technol. Sports," "34%") | Journal does not exist | R. J. Daza, J. E. Tambalque, C. A. Ho, K. C. Moreno, "Courtyard Reserva: A Web-Based Booking System for Community Sports Facilities…," *IJRSI* 13(2), pp. 673–687, 2026 (PH) · J. D. German et al., "Appoint Deportes: An Online Reservation System for Sports Facilities," *Proc. 7th ICCMB*, 2024, pp. 206–211 (PH) | Real PH court-reservation systems exist and are ISO-25010-evaluated; the documented gap becomes: web-only, no matchmaking, no geospatial indexing, not corridor-scoped |
| [38] Chua 2020 ("47% higher participation") | No such study | H. Cho, G. A. Abbasi, H.-K. Kang, Y. H. Lee, "Exploring Constraints and Sport Experiences: A Case Study of Adult Workers in Singapore," *Behavioral Sciences* 14(9):848, 2024 | Coordination/time constraints are documented barriers to adult recreational sport; purpose-built tooling addresses the structural constraint layer (with Preece) — remove invented 47% |
| [39] Martinez & Nguyen 2021 ("74% churn") | No such study | (covered by flow theory + EOMM above) | Remove invented survey; churn-balance link stated qualitatively |
| [42] Santos & Dela Cruz 2023, IJACSA ("4.42/4.28") | Not found in IJACSA | Courtyard Reserva (above) as the local ISO 25010 precedent | Local benchmark described by its actually reported outcomes (high usability; satisfactory functionality/reliability) |
| [43] Bautista et al. 2022, PCS Nat. Conf. | Unverifiable | — (redundant after the two real PH systems) | — |

## Real but miscited — FIXED

| Old ref | Problem | Fix |
|---|---|---|
| [31] Biørn-Hansen et al. — cited as native-vs-RN GIS benchmark "parity in 73%" but listed title is their **PWA** paper | Wrong paper + invented statistic | A. Biørn-Hansen, C. Rieger, T.-M. Grønli, T. A. Majchrzak, G. Ghinea, "An Empirical Investigation of Performance Overhead in Cross-Platform Mobile Development Frameworks," *Empir. Softw. Eng.* 25:2997–3040, 2020 — findings stated accurately (measurable but feature-dependent overhead; RN competitive for UI-centric workloads) |
| [32] Majchrzak et al., HICSS 2017 — "87.3%/74.1% reuse" | Paper is real; the percentages are not in it | Keep citation; restate finding qualitatively (high cross-platform reuse potential; RN/Ionic/Fuse assessment) |
| [9] Statcounter "Q3 2024: 75.3%/24.7%" | Outdated/wrong figures | Statcounter PH, **June 2026: Android 88.23% / iOS 11.74%** — strengthens the Android-first, cross-platform argument |
| [41] DICT NICTHS 2022 — "78.4% / 71.2% / 64.8%" | Figures don't match any published NICTHS table | **2024 NICTHS (DICT & PSA)**: 48.8% of households with home internet; 2 in 3 individuals 10+ used the internet; CALABARZON smartphone ownership among mobile users **95.8%** vs 93.0% national; CALABARZON 2nd in daily internet time (5.3 h) |
| [18] ISO/IEC 25010:2011 | Superseded | Cite **ISO/IEC 25010:2023** |
| [15] USAPA Rulebook 2023 | Fine, but tiers need grounding | Add **USA Pickleball Player Skill Rating definitions** (usapickleball.org) backing the Beginner ≈2.0–2.5 / Intermediate 3.0–3.5 / Advanced 4.0+ bands |

## New context added (verified, current)

- Philippine Pickleball Federation: POC-recognized National Sports Association
  (May 2024); 211 clubs/13k members (Mar 2025) growing to 250+ clubs; first
  Philippine National Championship (May–Jun 2025); PPP Registry announced
  (Feb 2026). Sources: PPF site, Wikipedia/PPF, Tribune (Jun 2026), Global
  Pickleball Federation news. Grounds Chapter 1's growth narrative with
  citable facts instead of vibes.

## Never cited in text — resolved

[11] Jannach et al. → now cited in the hybrid-recommender paragraph ·
[14] Sarwar et al. → cited for item-based CF · [16] RN New Architecture →
cited in Native Module Interoperability definition · [49] Hermes → cited in
the performance paragraph · [44] Reyes & Ignacio → DROP (unverifiable and
uncited) · [17]≡[30] Wasserman duplicate → single entry.

## Everything else — KEEP (verified real)

Salton & McGill 1983 · Manning et al. 2008 · Longley et al. 2015 · W3C
Geolocation 2022 · React Native docs · Nielsen 1994 · Shneiderman 1998 ·
Norman 2013 · Burke 2002 · Adomavicius & Tuzhilin 2005 · Goldberg et al.
1992 · Resnick et al. 1994 · Pazzani & Billsus 2007 · Sinnott 1984 · Kling
1999 · Sawyer & Eschenfelder 2002 · Preece 2000 · Richey & Klein 2007 ·
Schwaber & Sutherland 2020 · Creswell 2014 · Nielsen & Landauer 1993.

**Net effect:** every number a panelist can Google now checks out, and the
research-gap argument survives intact — the corridor still has no purpose-built,
matchmaking-capable, geospatially indexed pickleball platform.
