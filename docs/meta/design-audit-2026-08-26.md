# Vectis frontend design audit — 2026-08-26

**Scope:** Marketplace landing/listings, sign-in, dashboard overview, mutual-aid, publish builder  
**Method:** Web Interface Guidelines + ui-taste structure/a11y review + Playwright probe (1440 / 390) on `http://127.0.0.1:5422`  
**Evidence:** `.dev/design-audit/*.png`, `.dev/design-audit/findings.json`  
**Theme note:** Automated pass captured **light** mode; maintainer screenshots often show **dark**. Dual-theme personality is intentional but currently diverges (purple light vs cyan dark).

---

## Verdict

**Look:** Coherent product shell (tokens, badges, lane icons, status chips). Marketplace hero is more balanced than the prior left-card layout.  
**Feel / fluidity:** Browse path is slowed by stacked chrome (trust bar + multiple kernel/risk banners + discovery import + QR) before listings. Listing cards still read as near-duplicates when `unitDefinition` is lane-generic. Motion/a11y polish incomplete (`scroll-smooth`, `transition-all`, no skip link, static document title).

**Overall:** Strong foundation, **P0/P1 friction is density + information hierarchy**, not missing chrome.

---

## Priority findings

### P0 — Structure / cognitive load

| ID | Finding | Where |
|----|---------|--------|
| A1 | **Pre-listings chrome stack** — trust bar + Kernel truth (expanded) + discovery Kernel truth + Credits risk details sit above sidebar/listings. First useful browse content is far down. | `marketplace-live-browse`, `marketplace-trust-notes`, `kernel-truth-banner`, page composition |
| A2 | **Listings toolbar is operator-dense** — Post a job + Import discovery draft + Share import QR compete with search/sort. Browse users hit transport tooling before filters. | `marketplace-toolbar.tsx`, `discovery-draft-import-cta.tsx` (inline) |
| A3 | **Near-identical listing cards** — titles collapse to lane label when unit text is short/generic; offer IDs help but don’t restore scannability. | `enrichListing` / live offers; listing cards |

### P1 — Look & feel / hierarchy

| ID | Finding | Where |
|----|---------|--------|
| B1 | **[Fixed]** Primary CTA color mismatch in light mode — light `--primary` was purple (275) vs cyan dark (220); listing Start hover used `sky-300`. Light primary now hue 220; marketplace actions use `--primary`. | `globals.css`, `listing-card.tsx` |
| B2 | **Hero supporting copy is long** for first-viewport budget (rewards + milestones). Reads marketing-essay vs one short sentence. | `marketplace-hero.tsx` |
| B3 | **Hardcoded sky hover on listing cards** (`hover:border-sky-400`, `hover:bg-sky-300`) bypasses `--primary` — feels off-token in light purple theme. | `listing-card.tsx` |
| B4 | **Static `document.title`** — every route shows `Vectis — Marketplace` (sign-in, dashboard, builder). Hurts tabs/history and orientation. | `app/layout.tsx` metadata |
| B5 | **Signed-out dashboard** is honest but empty — large void + placeholder chart; fine for empty-state archetype, weak “fluid workspace” feel. | `overview-page` |

### P2 — Fluidity / motion / a11y (guidelines)

| ID | Finding | Where |
|----|---------|--------|
| C1 | **No skip link** to `<main>` | all audited routes |
| C2 | **`scroll-smooth` on `html`** without `prefers-reduced-motion` override | `globals.css` |
| C3 | **`transition-all`** on shared Button (and auth carousel) | `components/ui/button.tsx`, `auth-carousel.tsx` |
| C4 | **Nav links** lack explicit `focus-visible:ring-*` (rely on generic outline tokens) | `site-header.tsx` |
| C5 | **≥1 input missing accessible name** on marketplace/mutual-aid/builder probe | Playwright `inputs-missing-label:1` |
| C6 | **Listing filter Apply gate** — URL updates only on submit (OK for shareable state) but feels less fluid than live filter | `marketplace-filters.tsx` |
| C7 | **Sign-in form length** — key + backup sections force scroll; right carousel is polished but left column feels stacked | `sign-in` / `SignInForm` |

### Pass / strengths

- Semantic `<main>`, single `h1` per audited route  
- Mobile: no horizontal overflow at 390px  
- Lane + status icons improve scan of categories/chips  
- Empty listing / connection panels have clear CTAs  
- Dashboard nav groups (Workspace / Act / Operate) match ui-taste workflow phases  
- Search/sort have `aria-label`  
- Icon-only header controls mostly labeled (menu, theme, window controls)

---

## Fluidity map (browse loop)

```
Header (sticky)
→ Trust bar (node + founding)
→ Hero (centered) + trust/import band
→ Kernel / risk banners (often 2–3)
→ Sidebar + Listings
   → Post job + Import + QR
   → Search / sort / Apply
   → Cards
```

**Friction:** 4–6 vertical bands before card interaction.  
**Recommendation:** Collapse risk/kernel into one compact disclosure by default; move Import/QR to builder or a “Tools” overflow; keep Post a job + search as the listings header pair.

---

## Suggested next iteration (ranked)

1. **[Done 2026-08-26]** Collapse marketplace chrome — one Kernel/risk disclosure (closed by default); demote Import/QR from listings header (hero keeps a quiet builder link; QR stays on builder).
2. **[Done 2026-08-26]** Unify primary accent — light `--primary` aligned to cyan hue (220) with dark; marketplace CTAs/hovers use `--primary` instead of hardcoded `sky-*`.
3. **Per-route titles** + skip link + `prefers-reduced-motion` for `scroll-smooth`.
4. **Listing title quality** — ensure Standard publish packs title/description so cards don’t all read as the lane name.
5. Replace `transition-all` on Button with explicit properties.

---

## Probe summary

| Route | H1 | Skip link | Overflow-X | Notes |
|-------|----|-----------|------------|-------|
| `/marketplace` | ok | missing | none | unlabeled input:1 |
| `/sign-in` | ok | missing | none | split auth looks strong |
| `/dashboard` | ok | missing | none | signed-out empty OK |
| `/marketplace/mutual-aid` | ok | missing | none | unlabeled input:1 |
| `/dashboard/builder?step=offer` | ok | missing | none | unlabeled input:1 |

MCP client ladder was blocked on a stale session during this pass — Playwright probe used instead for visual evidence.
