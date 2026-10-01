Here's the guide. Save it, use it when you actually need handovers.

---

## Shift Handover — Feature Guide

### What it's for

A shift is opened by one cashier. That cashier leaves mid-shift (break, end of their hours, emergency). A manager takes over the physical cash drawer and closes the shift on the cashier's behalf. The shift stays under the original cashier's `userId` — the handover only records who requested it and who resolved it.

### Data model

`KxTillShift` has these fields for handover:

- `handoverRequestedById` — user who requested the handover
- `handoverResolvedById` — user who resolved it
- `handoverResolvedAt` — timestamp
- `handoverNote` — free text (passed at request and/or resolution)

`closureType` becomes `"HANDOVER"` on resolve.

### Permissions required

| Action | Permission |
|---|---|
| Request handover | `kxtill.shift.open` (any user with shift access) |
| Resolve handover | `kxtill.shift.resolve_handover` |
| Reject handover | `kxtill.shift.resolve_handover` |

Owner and platform admins bypass all checks.

### Endpoints

**1. Request handover**

```
POST /organizations/:orgId/kxtill/shifts/:shiftId/handover/request
Body: { "note": "optional" }
```

Rules:
- The requester cannot be the shift owner (you can't handover your own shift).
- The shift must be `status: "OPEN"`.
- The shift must not already have `handoverRequestedById` set.
- Any user with `kxtill.shift.open` can request — typically the outgoing cashier calls this before walking away.

Sets `handoverRequestedById` and `handoverNote`. Shift stays `OPEN`.

**2. Resolve handover**

```
POST /organizations/:orgId/kxtill/shifts/:shiftId/handover/resolve
Body: { "declaredCash": <number>, "note": "optional" }
```

Rules:
- Requires `kxtill.shift.resolve_handover`.
- Shift must have `handoverRequestedById` set.
- Shift must be `status: "OPEN"`.

Computes `expectedCash` and `variance` exactly like a normal close. Applies the same threshold logic:
- `|variance| <= threshold` → `status: "CLOSED"`
- `|variance| > threshold` → `status: "CLOSED_PENDING_REVIEW"`

Sets `closureType: "HANDOVER"`, `closedById = resolver`, `closedAt`, `handoverResolvedById`, `handoverResolvedAt`. The shift's `userId` (owner) is unchanged.

**3. Reject handover**

```
POST /organizations/:orgId/kxtill/shifts/:shiftId/handover/reject
Body: { "note": "optional" }
```

Rules:
- Requires `kxtill.shift.resolve_handover`.
- Shift must have `handoverRequestedById` set.

Clears `handoverRequestedById` and stores the rejection note. Shift stays `OPEN`. The original cashier can continue operating or request again.

### Workflow

```
Cashier A opens shift.
Cashier A rings sales normally (shiftId attached to each sale).
Cashier A needs to leave.

   Option 1: Cashier A closes shift themselves (normal close).
   Option 2: Cashier A requests handover
             → shift stays OPEN
             → manager sees request
             → manager physically counts cash, enters declared amount
             → resolve: shift closes with closureType HANDOVER
             → variance handled like normal close
             → if variance > threshold, still enters review queue

   Option 3: Manager rejects the request
             → shift stays OPEN under Cashier A
             → A closes it normally when they return
```

### Audit actions fired

| Action | Endpoint |
|---|---|
| `KXTILL_SHIFT_HANDOVER_REQUESTED` | request |
| `KXTILL_SHIFT_HANDOVER_RESOLVED` | resolve |
| `KXTILL_SHIFT_HANDOVER_REJECTED` | reject |

All logged with `shiftId`, `branchId`, `shiftOwnerId`, note, and (on resolve) the declared/expected/variance numbers.

### Frontend considerations

- **Cashier UI:** on the shift screen, show a "Request handover" button. Only visible while the shift is `OPEN` and `handoverRequestedById` is null.
- **Manager UI:** a "Pending handovers" list querying shifts where `handoverRequestedById != null AND status = "OPEN"`. Each row has Resolve (opens a cash-count form) and Reject (with optional note).
- **No automatic resolution.** A handover sits pending until someone acts on it.

### Testing checklist (when you get to it)

- [ ] Open shift as user A.
- [ ] As user B, request handover → `handoverRequestedById = B`.
- [ ] As user B, resolve with declared cash → shift closes, `closureType = "HANDOVER"`, `handoverResolvedById = B`, `closedById = B`, `userId` still = A.
- [ ] Repeat, but reject instead of resolve → shift stays `OPEN`, `handoverRequestedById` cleared.
- [ ] Confirm audit log shows all three actions.
- [ ] Confirm a second request while one is pending fails.
- [ ] Confirm the shift owner cannot request handover on their own shift.

### Not implemented

- **Transferring shift ownership.** The shift remains under the original `userId`. If you need to change who owns the shift mid-flight, that's a different feature.
- **Notification on request.** No automatic ping to managers. Frontend needs to poll the pending-handovers list or listen to a websocket. Not in this module.
- **Automatic close on handover timeout.** A stale handover request sits forever until someone acts. If you want auto-reject after N hours, that's a cron addition, not part of this module.

---

Save it. When you're actually ready to build the frontend handover UI or test the flow with a second user, the reference is there.