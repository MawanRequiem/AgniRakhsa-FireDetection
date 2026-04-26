# IFRIT Dashboard — Technical Quality Audit

> Audited scope: `web/` — Full monitoring dashboard (Login, Dashboard, Rooms, Room Detail, CCTV, Devices, Alerts, Notifications)
> Audit date: 2026-04-26
> Design context: [web/.impeccable.md](file:///e:/AgniRakhsa-FireDetection/web/.impeccable.md)

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | **1/4** | Interactive elements missing ARIA labels; heading hierarchy broken; color-only status indicators |
| 2 | Performance | **2/4** | Multiple unconstrained polling intervals; no memoization on expensive filters |
| 3 | Theming | **2/4** | Token system exists but heavily mixed with hard-coded hex values; light/dark parity incomplete |
| 4 | Responsive Design | **2/4** | Mobile sidebar breaks layout; touch targets too small; tables don't adapt for mobile |
| 5 | Anti-Patterns | **1/4** | Multiple AI slop tells: glassmorphism login, gradient button, glow shadows, Inter font, left border stripes |
| **Total** | | **8/20** | **Poor — Major overhaul required** |

---

## Anti-Patterns Verdict

**FAIL — This looks AI-generated.** Here are the specific tells:

````carousel
### Tell 1: Glassmorphism Login Card
The login page uses `backdrop-blur-xl`, `bg-[#121214]/80`, and `shadow-2xl` with `rounded-[2rem]` — textbook AI dashboard template.

![Login Page](file:///C:/Users/Personal/.gemini/antigravity/brain/bcdbc0b9-d85c-45ea-988f-1fc8ff788c6e/login_page_1777203125406.png)
<!-- slide -->
### Tell 2: Gradient CTA Button
`bg-gradient-to-r from-orange-600 to-orange-500` with `shadow-[0_4px_15px_rgba(249,115,22,0.3)]` — banned glow + gradient combo.

```jsx
// Login.jsx:135
className="bg-gradient-to-r from-orange-600 to-orange-500 
           hover:from-orange-500 hover:to-orange-400
           shadow-[0_4px_15px_rgba(249,115,22,0.3)]"
```
<!-- slide -->
### Tell 3: Decorative Glow Blobs
Login background uses `blur-[120px] rounded-full` glow orbs — pure AI decoration.

```jsx
// Login.jsx:61-62
<div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] 
     bg-orange-600/10 blur-[120px] rounded-full" />
```
<!-- slide -->
### Tell 4: Left Border Accent Stripe
`MetricCard` uses a colored left border strip — a [banned pattern](file:///e:/AgniRakhsa-FireDetection/web/.impeccable.md).

```jsx
// MetricCard.jsx:44
<div className={`absolute left-0 top-0 bottom-0 w-1 
     ${color === 'blue' ? 'bg-transparent' : 'bg-current opacity-70'}`} />
```
<!-- slide -->
### Tell 5: Generic Font (Inter)
Using Inter — the default AI-generated font choice. Geist is installed but unused.

```css
/* index.css:148 */
font-family: 'Inter', system-ui, sans-serif;
```
````

---

## Executive Summary

- **Audit Health Score: 8/20 (Poor)**
- **Total issues: 27** (P0: 3, P1: 10, P2: 9, P3: 5)
- **Top 5 critical issues:**
  1. Brand identity mismatch — still says "AgniRaksha" everywhere, accent is amber not red
  2. Devices page shows raw UUIDs instead of room names in the dropdown
  3. Login page is a completely different design language (glassmorphism) from the dashboard
  4. Dashboard is uninformative when no telemetry is active — just says "AWAITING TELEMETRY DATA..."
  5. Rooms page groups by status tabs instead of showing direct status per room

---

## Detailed Findings by Severity

### P0 — Blocking

**[P0] Brand Identity Mismatch — Wrong name, wrong accent color**
- **Location**: Sidebar, Header, Login, Footer — every component
- **Category**: Anti-Pattern
- **Impact**: Customers see "AgniRaksha" instead of "IFRIT". The amber accent contradicts the red brand established on the landing page. This is a product identity crisis.
- **Recommendation**: Global rebrand — update sidebar logo text, login branding, header title, all amber accent tokens to IFRIT red.
- **Suggested command**: `/shape`

---

**[P0] Devices Page Shows Raw UUIDs**
- **Location**: [DeviceManagement.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/DeviceManagement.jsx) — Camera tab, "Assigned Room" column
- **Category**: Anti-Pattern / UX
- **Impact**: Customers see `c0a6781d-1227-459d-be...` instead of "Mock IoT Test Lab". Completely unusable for a facility manager.

![Devices showing UUID](file:///C:/Users/Personal/.gemini/antigravity/brain/bcdbc0b9-d85c-45ea-988f-1fc8ff788c6e/devices_page_1777203185811.png)

- **Recommendation**: The `RoomSelector` component correctly uses room names in its dropdown, but the *displayed value* shows the raw UUID. Fix the `SelectValue` to resolve room name from the rooms array.
- **Suggested command**: `/shape`

---

**[P0] Login Page Is a Different Product**
- **Location**: [Login.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Login.jsx)
- **Category**: Anti-Pattern
- **Impact**: The login uses glassmorphism, gradient buttons, glow blobs, and rounded-[2rem] cards — completely disconnected from the flat, industrial dashboard. It's also the first thing customers see.
- **Recommendation**: Redesign login to match the IFRIT brand and dashboard design language. Kill the glassmorphism.
- **Suggested command**: `/shape`

---

### P1 — Major

**[P1] Dashboard Is Uninformative When Idle**
- **Location**: [Dashboard.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Dashboard.jsx), [SensorsOverview.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/SensorsOverview.jsx)
- **Category**: UX
- **Impact**: When no telemetry is streaming, the entire chart area shows "AWAITING TELEMETRY DATA..." — a massive empty space. The dashboard should still be useful: show last-known values, system uptime, device health summary, etc.

![Dashboard empty state](file:///C:/Users/Personal/.gemini/antigravity/brain/bcdbc0b9-d85c-45ea-988f-1fc8ff788c6e/dashboard_page_1777203168280.png)

- **Recommendation**: Replace idle state with meaningful content: last readings timestamp, system uptime, device connection summary. Show "No active telemetry — last data received X hours ago" instead of raw debug text.
- **Suggested command**: `/shape`

---

**[P1] Rooms Page Uses Status Tab Grouping Instead of Direct Status**
- **Location**: [Rooms.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Rooms.jsx)
- **Category**: UX
- **Impact**: User requested removal of status tab grouping. Currently shows All/Safe/Warning/High/Critical tabs. Room cards should display their status directly — no need for tab filtering.
- **Recommendation**: Remove `Tabs` component. Show all rooms in a grid with inline status badges.
- **Suggested command**: `/shape`

---

**[P1] No Keyboard Focus Indicators**
- **Location**: Global — all interactive elements
- **Category**: Accessibility
- **Impact**: Tab navigation shows no visible focus ring on sidebar links, table rows, or action buttons. WCAG 2.4.7 violation.
- **Recommendation**: Add `focus-visible:ring-2 focus-visible:ring-offset-2` to all interactive components.
- **Suggested command**: `/shape`

---

**[P1] Color-Only Status Indicators**
- **Location**: [StatusIndicator.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/ui/StatusIndicator.jsx), [RoomCard.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/RoomCard.jsx)
- **Category**: Accessibility
- **Impact**: Room status is communicated solely through colored dots (green = safe, red = critical). Color-blind users cannot distinguish. WCAG 1.4.1 violation.
- **Recommendation**: Add text labels or icons alongside color dots. "SAFE" text, checkmark icon, etc.
- **Suggested command**: `/shape`

---

**[P1] Missing Heading Hierarchy**
- **Location**: Dashboard, Rooms, Alerts pages
- **Category**: Accessibility
- **Impact**: Dashboard uses `<h2>` for main title but `<h3>` for section headers with no logical nesting. Multiple pages skip heading levels. Screen reader users can't navigate by headings.
- **Standard**: WCAG 1.3.1
- **Recommendation**: Establish consistent heading hierarchy per page.
- **Suggested command**: `/shape`

---

**[P1] Alert Error Dialog Uses `window.alert()`**
- **Location**: [Login.jsx:42](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Login.jsx#L42)
- **Category**: UX / Accessibility
- **Impact**: `alert('Login Gagal: ' + error.message)` blocks the UI thread and uses the raw browser dialog. Unprofessional for a customer-facing product.
- **Recommendation**: Use `sonner` toast (already installed) for error messages.
- **Suggested command**: `/shape`

---

**[P1] Mixed Language UI Copy**
- **Location**: Login page (Indonesian), Dashboard (English), Header (Indonesian locale)
- **Category**: UX
- **Impact**: "Selamat Datang", "Silakan masuk", "Ingat saya", "Lupa sandi?" mixed with English labels. Customer-facing product needs consistent language.
- **Recommendation**: Standardize to English throughout (or implement proper i18n).
- **Suggested command**: `/shape`

---

**[P1] Header Shows "AgniRaksha" When pageTitles Map Misses Routes**
- **Location**: [Header.jsx:47](file:///e:/AgniRakhsa-FireDetection/web/src/components/layout/Header.jsx#L47)
- **Category**: UX
- **Impact**: The `/devices` route is missing from `pageTitles`, so the header falls back to "AgniRaksha" instead of "Device Management". Confusing.
- **Recommendation**: Add all routes to the `pageTitles` map and change fallback to "IFRIT".
- **Suggested command**: `/shape`

---

**[P1] Hard-Coded Colors Throughout**
- **Location**: Login.jsx (20+ raw hex), Dashboard.jsx (5+ raw hex), MetricCard.jsx (3+ raw hex)
- **Category**: Theming
- **Impact**: Colors like `#f59e0b`, `#ef4444`, `#0a0a0b`, `#121214` bypass the token system. Theme switching partially fails. Maintenance nightmare.
- **Recommendation**: Replace all raw hex with `var(--agni-*)` tokens or Tailwind theme references.
- **Suggested command**: `/colorize`

---

**[P1] CCTV Page Has No "No Signal" State**
- **Location**: [CCTVMonitor.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/pages/CCTVMonitor.jsx)
- **Category**: UX
- **Impact**: Camera shows as a blank white rectangle with just a "PC Webcam" label. No visual indication of offline/no-signal/connecting state.
- **Recommendation**: Add proper camera state indicators: "NO SIGNAL", "CONNECTING...", "OFFLINE" with appropriate visuals.
- **Suggested command**: `/shape`

---

### P2 — Minor

**[P2] Dashboard MCU Table Shows Short Hex IDs**
- **Location**: [DevicesTable.jsx](file:///e:/AgniRakhsa-FireDetection/web/src/components/dashboard/DevicesTable.jsx)
- **Impact**: Shows `ID: F371A453` — meaningless to facility managers.
- **Recommendation**: Show device name prominently, MAC address as secondary info.

**[P2] Multiple Unconstrained Polling Intervals**
- **Location**: Dashboard (15s), Rooms (15s), DeviceManagement (10s), RoomDetail (5s)
- **Impact**: Four pages polling independently, even when not visible. Wastes bandwidth.
- **Recommendation**: Pause polling when page is not visible (`document.hidden`). Consider centralizing via WebSocket (already partially implemented).

**[P2] `window.innerWidth` Check in Sidebar Render**
- **Location**: [Sidebar.jsx:43](file:///e:/AgniRakhsa-FireDetection/web/src/components/layout/Sidebar.jsx#L43)
- **Impact**: `typeof window !== 'undefined' && window.innerWidth < 768` is called on every render, doesn't react to resize.
- **Recommendation**: Use a proper media query hook or CSS breakpoints.

**[P2] RoomDetail Shows API Path as Help Text**
- **Location**: [RoomDetail.jsx:189](file:///e:/AgniRakhsa-FireDetection/web/src/pages/RoomDetail.jsx#L189)
- **Impact**: "Configure via /api/v1/cameras/" is developer debug text, not customer-facing copy.
- **Recommendation**: Replace with actionable user copy: "Go to Devices to register a camera for this room."

**[P2] Login Page Footer Shows Internal Project Name**
- **Location**: [Login.jsx:161](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Login.jsx#L161)
- **Impact**: `© 2026 AgniRaksha Systems - PBL PNJ` — internal academic project identifier visible to customers.
- **Recommendation**: Change to `© 2026 IFRIT Fire Detection Systems` or similar.

**[P2] Unused Dependencies**
- **Location**: [package.json](file:///e:/AgniRakhsa-FireDetection/web/package.json)
- **Impact**: `@base-ui/react` and `@fontsource-variable/geist` are installed but appear unused.
- **Recommendation**: Remove unused packages or use Geist as the primary font.

**[P2] HoverClue Tooltip Has Indonesian Text**
- **Location**: [Rooms.jsx:41](file:///e:/AgniRakhsa-FireDetection/web/src/pages/Rooms.jsx#L41), [RoomDetail.jsx:199](file:///e:/AgniRakhsa-FireDetection/web/src/pages/RoomDetail.jsx#L199)
- **Impact**: Tooltip text is in Indonesian while UI is English. Inconsistent.

**[P2] Dynamic Import for Logout**
- **Location**: [Header.jsx:167-168](file:///e:/AgniRakhsa-FireDetection/web/src/components/layout/Header.jsx#L167-L168)
- **Impact**: `const { customFetch } = await import('@/lib/api')` is unnecessary — the import is already available at the top of the file.
- **Recommendation**: Use the existing top-level import.

**[P2] Hazard Stripe Pattern**
- **Location**: [index.css:190-199](file:///e:/AgniRakhsa-FireDetection/web/src/index.css#L190-L199)
- **Impact**: Diagonal hazard stripes on critical alerts — industrial decoration that may not translate well to a "refined professional" dashboard.
- **Recommendation**: Evaluate if this fits the new IFRIT brand direction.

---

### P3 — Polish

**[P3]** `card-shadow` uses hard-coded `rgba(0,0,0,0.1)` — should use token-based shadow.
**[P3]** Login checkbox uses `accent-orange-500` — should match IFRIT red brand.
**[P3]** `animate-fade-in` references `fade-in` keyframes but the defined keyframe is `fadeIn` — animation may not work.
**[P3]** Two store directories exist: `store/` and `stores/` — consolidate to one.
**[P3]** Tab title shows "AgniRaksha — SCADA Terminal" — should be "IFRIT" and "SCADA Terminal" is overly technical for customers.

---

## Patterns & Systemic Issues

| Pattern | Frequency | Root Cause |
|---------|-----------|------------|
| Hard-coded hex colors bypassing tokens | 40+ instances across 8 files | No enforcement of token usage; Login page was built separately |
| Indonesian text in English UI | 6 instances | No i18n strategy; original development in Indonesian |
| Raw UUIDs shown to users | 3 instances (Devices, Dashboard MCU, Camera ID) | Backend returns IDs; frontend doesn't always resolve to names |
| ALL_CAPS monospace terminal aesthetic | Throughout Dashboard | Original "industrial SCADA" concept doesn't match "refined professional" target |
| Empty states with debug text | 4 instances | Placeholder text never replaced with production copy |

---

## Positive Findings

1. **Solid component architecture** — Clean separation between pages, layout, dashboard components, and UI primitives. Good foundation to build on.
2. **Design token system exists** — The `--agni-*` CSS custom properties are well-structured with proper light/dark variants. The infrastructure is there; it's just not used consistently.
3. **WebSocket implementation** — Real-time connection with status indicator is well-implemented. Good foundation for live data.
4. **Proper auth flow** — HttpOnly cookie + CSRF token pattern is correct. In-memory Zustand store for auth state is the right approach.
5. **Responsive grid foundation** — Pages use proper grid breakpoints (`sm:grid-cols-2 lg:grid-cols-3`). The foundation for mobile support exists.
6. **Proper loading states** — Skeleton loading and spinner states are implemented for most data-fetching scenarios.
7. **`prefers-reduced-motion` respected** — Already has a media query to disable animations.

---

## Recommended Actions

1. **[P0] `/shape`** — Full dashboard redesign: IFRIT rebrand, new login page, restructured Rooms page (remove tabs), enriched Dashboard idle state, fix UUID display on Devices, improve CCTV empty states
2. **[P1] `/colorize`** — Replace all hard-coded hex colors with design tokens; update accent palette from amber to IFRIT red
3. **[P1] `/clarify`** — Fix all mixed-language copy; replace Indonesian text with English; remove debug/internal text from customer-facing views
4. **[P1] `/typeset`** — Replace Inter with a distinctive font (Geist is already installed); establish proper heading hierarchy
5. **[P2] `/optimize`** — Pause polling when tab is hidden; fix `window.innerWidth` render check; clean up unused dependencies
6. **[P2] `/polish`** — Final pass after all fixes: verify dark mode parity, focus indicators, touch targets, consistent empty states

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `/audit` after fixes to see your score improve.
