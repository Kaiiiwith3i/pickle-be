# Pickle C-LB — Hybrid Filtering Engine Evaluation

Seed 20260711 · population 60 · 50 labeled pairs · label source: provisional USAPA rubric (pending expert validation)

## Condition: cold start

| τ | TP | FP | FN | TN | Precision | Recall | F1 |
|---|----|----|----|----|-----------|--------|-----|
| 0.75 | 21 | 5 | 1 | 23 | 0.808 | 0.955 | 0.875 |
| 0.80 | 21 | 5 | 1 | 23 | 0.808 | 0.955 | 0.875 |
| 0.85 | 18 | 3 | 4 | 25 | 0.857 | 0.818 | 0.837 |
| 0.90 | 18 | 1 | 4 | 27 | 0.947 | 0.818 | 0.878 ★ |
| 0.95 | 13 | 0 | 9 | 28 | 1.000 | 0.591 | 0.743 |

Optimal τ* = 0.90 (F1 = 0.878)

## Condition: post adoption

| τ | TP | FP | FN | TN | Precision | Recall | F1 |
|---|----|----|----|----|-----------|--------|-----|
| 0.75 | 21 | 5 | 1 | 23 | 0.808 | 0.955 | 0.875 |
| 0.80 | 21 | 5 | 1 | 23 | 0.808 | 0.955 | 0.875 |
| 0.85 | 18 | 3 | 4 | 25 | 0.857 | 0.818 | 0.837 |
| 0.90 | 18 | 1 | 4 | 27 | 0.947 | 0.818 | 0.878 ★ |
| 0.95 | 13 | 0 | 9 | 28 | 1.000 | 0.591 | 0.743 |

Optimal τ* = 0.90 (F1 = 0.878)

## Ranking quality (all gate-passing candidates per seeker)

| Condition | Seekers | Precision@3 | MAP |
|-----------|---------|-------------|-----|
| Cold start | 59 | 0.825 | 0.776 |
| Post-adoption | 59 | 0.831 | 0.786 |
