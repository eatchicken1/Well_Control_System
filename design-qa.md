# Design QA

## Source visual truth

- Source: `C:/Users/VANDER~1/AppData/Local/Temp/codex-clipboard-23612b85-72a1-4461-9ef6-fd93c972071c.png`
- Viewport: 1920 × 912 (inferred from the supplied screenshot)
- Intended state: authenticated `/monitoring` page with live well data visible

## Implementation evidence

- Local URL: `http://127.0.0.1:5173/monitoring`
- Implementation screenshot path: unavailable; the protected route redirected to the login screen because no local session was available.
- Browser console errors: none observed on the accessible login screen.

## Findings

- [P1] Visual comparison is blocked by authentication. The target monitoring screen could not be rendered in the local browser without a valid session, so the new topbar state chip and removed monitoring ribbons could not be checked at the target viewport.

## Focused region comparison

Blocked for the same reason. The topbar and curve region were not reachable in the local browser session.

## Implementation checklist

- [x] Move the monitoring status summary into the topbar on `/monitoring`.
- [x] Remove the full runtime status ribbon from the monitoring page.
- [x] Remove the curve deck sample/event/projection summary row.
- [x] Preserve the well tabs, KPI strip, curves, wellbore thumbnail, and alert queue.
- [x] Run the production build and UTF-8 round-trip checks.
- [ ] Re-capture the authenticated monitoring page at 1920 × 912 and compare against the supplied screenshot.

## Follow-up Polish

- None identified before the authenticated visual comparison.

final result: blocked
