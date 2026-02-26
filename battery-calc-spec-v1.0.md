# Battery Calculator — Problem Statement & Algorithms

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-02-26 | Initial spec: E=L×T, N+C→E, candidate generation logic, Solve for T/L/E algorithms |

## Problem Statement

Fundamental equation: **E = L × T**

- **E** = Energy (Wh) = N × 3.6V × C / 1000
  - **N** = cells in series, always integer
  - **C** = cell capacity (mAh); nominal always required; Cmin, Cmax optional
  - Emin = N×3.6×Cmin/1000, Emax = N×3.6×Cmax/1000
- **L** = Load / power consumption (W); nominal always required; Lmin, Lmax optional
- **T** = Runtime (hours); nominal always required; Tmin, Tmax optional

Nominal values E (or N+C), L, T always required in their respective solve paths.
Min/max variants each independently optional.

---

## Consolidated Candidate Generation

**Step 1:** Collect all available values for each known category:
- E-set: {Emin, E, Emax} — include only those present
- L-set: {Lmin, L, Lmax} — include only those present
- T-set: {Tmin, T, Tmax} — include only those present

**Step 2:** Generate all candidates via pairwise combination of the two known sets.

**Step 3:**
- Nominal = always computed from E, L, T (always shown)
- result_min = min(all candidates) — shown only if < nominal
- result_max = max(all candidates) — shown only if > nominal

---

## Solve for T (given E and L)

- Build E-set from N, C, Cmin, Cmax
- Build L-set from L, Lmin, Lmax
- Candidates: all (Ei / Lj)
- **T = E / L** (always shown)
- **Tmin = min(candidates)** if < T
- **Tmax = max(candidates)** if > T

---

## Solve for L (given E and T)

- Build E-set from N, C, Cmin, Cmax
- Build T-set from T, Tmin, Tmax
- Candidates: all (Ei / Tj)
- **L = E / T** (always shown)
- **Lmin = min(candidates)** if < L
- **Lmax = max(candidates)** if > L

---

## Solve for E (given L and T)

Two sub-cases:

### Sub-case E-a: N known → solve for C (and Cmin, Cmax)
- Build L-set, T-set
- Candidates: all (Li × Tj) in Wh
- Convert: C = E_candidate / (N × 3.6) × 1000 (mAh)
- **C = (L×T)/(N×3.6)×1000** (always shown) — round up, footnote exact decimal
- **Cmin = min(candidates) converted** if < C — round up
- **Cmax = max(candidates) converted** if > C — round up

### Sub-case E-b: C (or Cmin) known → solve for N
- C_anchor = C if present, else Cmin
- Build L-set, T-set
- Candidates: all (Li × Tj) in Wh
- Convert: N = E_candidate / (3.6 × C_anchor / 1000)
- **N = (L×T)/(3.6×C_anchor/1000)** (always shown) — round up, footnote exact decimal
- **Nmin = min(candidates) converted** if < N — round up
- **Nmax = max(candidates) converted** if > N — round up

---

## Current file
`/mnt/user-data/outputs/battery-runtime-calculator.html`
