# Tech Debt Registry — BarberPilot_App

## 2026-08-06 — Login screen roster is a hardcoded array, not fetched live from the API

**Description**: `LoginScreen.js` renders its selectable barber tiles from
`TODOS_PERFILES` / `BARBEROS_FALLBACK` in `src/constants/index.js` — a
manually-maintained array. It is never reconciled against the live
`GET /barberos` endpoint (which the `barberpilot-api` repo's `checkin.html`
and `queue-dashboard.html` already do, each with a fallback to a hardcoded
array only if that fetch fails). This is the same source-of-truth-drift
pattern already documented in `barberpilot-api/TECH_DEBT.md`
("Hardcoded roster fallbacks... will drift again on the next roster
change") — it just hadn't been noticed in this repo yet.

**Concrete instance found**: Emerson (`b2`) was deactivated in the
`barberos`/`tenant_staff` tables in production (confirmed via live
`GET /barberos`, which no longer lists him) with no corresponding code
change — deactivation happens through the admin panel's
`PATCH /api/v2/staff/:bid/deactivate`, a runtime DB action invisible to
git history. His tile kept appearing on the login screen because nothing
here reads `activo`/`active` at all.

**Fix applied now**: removed the `b2`/Emerson line from `BARBEROS_FALLBACK`
in `src/constants/index.js` — a manual, one-off edit matching the exact
DB state as of 2026-08-06. This is a **patch, not the structural fix**:
the array will silently go stale again the next time a barber is
added, removed, or reactivated, exactly as happened here.

**Why deferred**: user explicitly requested the hardcoded-removal patch
rather than the structural live-fetch fix in this session; time/scope
tradeoff made by the user, not a technical judgment that the patch is
sufficient long-term.

**Severity**: Low — worst case is a dead tile that a deactivated barber
can tap but never authenticate through (server-side `/api/v2/auth/login`
independently rejects inactive `bid`s regardless of what this array says).
Not a security gap, a UX/staleness one.

**Urgency**: Monitor-only — revisit next time the barber roster changes
(add/remove/reactivate), since this array won't update itself.

**Status**: Open. Structural fix not implemented: have `LoginScreen.js`
fetch `GET /barberos` on mount and build tiles from the live response,
falling back to `BARBEROS_FALLBACK` only on fetch failure — mirroring the
pattern already used in `checkin.html`/`queue-dashboard.html`.
