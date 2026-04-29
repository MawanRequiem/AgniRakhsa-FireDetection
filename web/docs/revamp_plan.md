# IFRIT Dashboard — Full Revamp Implementation Plan

> Combines `/shape`, `/colorize`, `/clarify`, `/typeset`, `/optimize`, and `/polish` into a single execution plan.
> Design context: [web/.impeccable.md](file:///e:/AgniRakhsa-FireDetection/web/.impeccable.md)
> Audit findings: [dashboard_audit.md](file:///C:/Users/Personal/.gemini/antigravity/brain/bcdbc0b9-d85c-45ea-988f-1fc8ff788c6e/dashboard_audit.md)

---

## Design Brief (from `/shape`)

### Feature Summary
Full revamp of the IFRIT monitoring dashboard from "industrial SCADA prototype" to "refined professional building management system." Customer-facing product for facility security operators and building managers. Must communicate reliability, precision, and vigilance.

### Primary User Action
**Answer "is anything on fire?" in under 1 second** from any page. Secondary: drill into room details, manage devices, review alert history.

### Design Direction
- **Tesla meets Grafana** — clean surfaces with data density
- **IFRIT red** as primary brand accent (matching landing page), not amber
- **Refined professional** — no terminal cosplay, no ALL_CAPS_MONOSPACE everywhere
- Both light and dark themes, fully designed
- English-only UI copy

### Anti-Goals
- NOT a sci-fi control room
- NOT glassmorphism/gradient/glow (AI slop)
- NOT a minimal MVP — this must feel like a real product

---

## Proposed Changes

### Phase 1: Foundation (CSS + HTML + Fonts)

#### [MODIFY] [index.html](file:///e:/AgniRakhsa-FireDetection/web/index.html)
- Change `lang="id"` → `lang="en"`
- Change title from `AgniRakhsa — SCADA Terminal` → `IFRIT — Fire Detection Monitor`
- Replace Inter font import with **Plus Jakarta Sans** (professional, distinctive, not Inter)
- Keep JetBrains Mono for data readouts

#### [MODIFY] [index.css](file:///e:/AgniRakhsa-FireDetection/web/src/index.css)
- **Rebrand tokens**: Replace all amber/orange accent with IFRIT deep red palette:
  - `--ifrit-brand: #DC2626` (primary red)
  - `--ifrit-brand-hover: #B91C1C` (darker red)
  - Keep `--ifrit-safe`, `--ifrit-warning`, `--ifrit-fire`, `--ifrit-info` for semantic status
- **Rename token prefix**: `--agni-*` → `--ifrit-*` globally
- Replace `font-family: 'Inter'` → `font-family: 'Plus Jakarta Sans'`
- Remove `hazard-stripe` pattern (doesn't fit refined direction)
- Remove `card-shadow` hard edge style → use subtle `box-shadow` with token
- Fix `animate-fade-in` referencing wrong keyframe name
- Add focus-visible utilities

---

### Phase 2: Layout Shell (Sidebar + Header + MainLayout)

#### [MODIFY] [Sidebar.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/layout/Sidebar.jsx)
- Rebrand logo: "AgniRaksha" → "IFRIT"
- Change Flame icon background from amber to IFRIT red
- Change active nav item color from amber to IFRIT red
- Remove `window.innerWidth` check (line 43) — use CSS for logo show/hide

#### [MODIFY] [Header.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/layout/Header.jsx)
- Add missing routes to `pageTitles` map (`/devices`: "Devices")
- Change fallback title from "AgniRaksha" to "IFRIT"
- Remove dynamic import in logout handler — use existing top-level import
- Change hardcoded user info from "Admin Security" / "admin@agniraksha.local" to use auth store
- Replace amber `[ View Log ]` style accent with IFRIT red
- Update `StatusDot` labels from Indonesian to English

#### [MODIFY] [MainLayout.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/layout/MainLayout.jsx)
- Replace `backdrop-blur-sm` mobile overlay with solid dark overlay (no blur = less AI slop)

---

### Phase 3: Login Page (Complete Redesign)

#### [MODIFY] [Login.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Login.jsx)
- **Kill**: glassmorphism card, gradient button, glow blobs, blur background, `rounded-[2rem]`
- **New design**: Clean, flat, dark card matching IFRIT brand. Red accent CTA, no gradients.
- Rebrand: "AgniRaksha" → "IFRIT", "Intelligent Indoor Fire Detection" → "AI-Powered Fire Detection"
- Translate all Indonesian copy to English:
  - "Selamat Datang" → "Sign In"
  - "Silakan masuk untuk mengakses dashboard" → "Access your monitoring dashboard"
  - "Ingat saya" → "Remember me"
  - "Lupa sandi?" → "Forgot password?"
  - "Masuk Dashboard" → "Sign In"
  - "Belum punya akun? Hubungi Admin" → "Need access? Contact your administrator"
- Replace `window.alert()` with sonner toast for errors
- Change footer: "AgniRaksha Systems - PBL PNJ" → "IFRIT Fire Detection"

---

### Phase 4: Dashboard Page (Enrich + Rebrand)

#### [MODIFY] [Dashboard.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Dashboard.jsx)
- Change title from `SYSTEM_MONITOR` to "System Overview" (professional, not terminal)
- Change subtitle from `MULTI-MCU TELEMETRY NODE` to clean status text
- Remove ALL_CAPS_MONOSPACE from non-data elements (headings, labels)
- Change `CONNECTION_SECURE` → "Connected" / `CONNECTION_LOST` → "Disconnected"
- Change `[ View Log ]` accent from amber to IFRIT red
- Change `TEMP_C` / `GAS_PPM` labels to readable format: "Temperature" / "Gas Level"

#### [MODIFY] [MetricCard.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/MetricCard.jsx)
- Remove left border accent stripe (line 44) — banned pattern
- Replace hard-coded Tailwind color classes with token-based approach
- Keep the card clean and flat

#### [MODIFY] [SensorsOverview.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/SensorsOverview.jsx)
- Replace empty state `AWAITING TELEMETRY DATA...` with informative idle state:
  - "No active telemetry — waiting for sensor data"
  - Add subtle placeholder chart outline or icon
- Replace hard-coded hex colors (`#f59e0b`, `#ef4444`, etc.) with CSS variable references

#### [MODIFY] [DevicesTable.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/DevicesTable.jsx)
- Remove `ID: F371A453` display — show device name and room only
- Remove `SCANNING_DEVICES...` / `AWAITING_FIRMWARE_HANDSHAKE` debug text
- Replace with professional loading/empty states

#### [MODIFY] [AlertFeed.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/AlertFeed.jsx)
- Translate `SYSTEMS NOMINAL` / `NO_ACTIVE_ANOMALIES_DETECTED` to professional English

---

### Phase 5: Rooms Page (Remove Tab Grouping)

#### [MODIFY] [Rooms.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Rooms.jsx)
- **Remove** the `Tabs` component entirely (All/Safe/Warning/High/Critical tabs)
- Show all rooms in a flat grid with inline status badges
- Add a simple search/filter bar instead of status tabs
- Translate Indonesian HoverClue text to English

#### [MODIFY] [RoomCard.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/RoomCard.jsx)
- Show status as a prominent inline badge (not just a colored dot)
- Replace amber hover accent with IFRIT red
- Clean up text sizing — current 10px text is too small

---

### Phase 6: Device Management (Fix UUID Display)

#### [MODIFY] [DeviceManagement.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/DeviceManagement.jsx)
- Fix `RoomSelector` dropdown to show room name as the selected value (not UUID)
- Change amber accents to IFRIT red
- Translate any remaining Indonesian text

---

### Phase 7: Supporting Components & Global Fixes

#### [MODIFY] [StatusIndicator.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/ui/StatusIndicator.jsx)
- Translate Indonesian labels: "Aman" → "Safe", "Peringatan" → "Warning", "BAHAYA" → "Critical"
- Add `aria-label` for accessibility

#### [MODIFY] [AlertItem.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/AlertItem.jsx)
- Remove `hazard-stripe` usage on critical alerts → use solid red-tinted background instead

#### [MODIFY] [StatCard.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/StatCard.jsx)
- Replace hard-coded amber `rgba(245, 158, 11, 0.1)` with IFRIT red token

#### [MODIFY] [RoomDetail.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/RoomDetail.jsx)
- Replace "Configure via /api/v1/cameras/" with "Go to Devices to register a camera"
- Translate Indonesian HoverClue text

#### [MODIFY] [App.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/App.jsx)
- Change amber spinner to IFRIT red

---

### Phase 8: Token Rename (Global Find-Replace)

After all component changes, do a global rename:
- `--agni-*` → `--ifrit-*` across all files
- `agni-amber` → `ifrit-brand`
- Update all `var(--agni-*)` references

---

## Verification Plan

### Automated Tests
- Build check: `npm run build` must succeed with no errors
- Visual verification: Browser screenshots of all 7 pages in both light and dark mode

### Manual Verification
- Login page matches IFRIT brand (no glassmorphism, no gradients)
- Dashboard shows informative content even when idle
- Rooms page shows flat grid with inline status (no tabs)
- Devices page shows room names, not UUIDs
- All text is in English
- Red accent throughout, not amber
- Both light and dark mode work correctly
