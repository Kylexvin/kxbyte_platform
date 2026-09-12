**TODO:**


# KxTill Staff — Permission Injection

## Context

Roles in KXBYTE are personal permission bundles. Granting a member KxTill access
means injecting KxTill permissions into their existing role.

## Current State

### Already built
- ✅ `POST /organizations/:orgId/roles/:roleId/permissions` — add single permission
- ✅ `PATCH /organizations/:orgId/roles/:roleId/permissions` — update set (diff add/remove)
- ✅ `GET /organizations/:orgId/permissions?productKey=kxtill` — permission catalog
- ✅ `GET /organizations/:orgId/kxtill/staff` — list members with kxtill.* perms
- ✅ `PATCH /organizations/:orgId/kxtill/staff/:userId` — update role/branches/active
- ✅ `DELETE /organizations/:orgId/kxtill/staff/:userId` — remove access

## Issues to Fix

### 1. `removeKxTillAccess` is wrong scope
Currently deactivates the entire org membership.
Should strip only `kxtill.*` permissions from the member's role.

**Fix:**
```js
// In staff.service.js — removeKxTillAccess
const membership = await orgDb.findMembership(targetUserId, organizationId);
const role = await roleDb.findRoleById(membership.roleId);
const kxTillPerms = role.permissions.filter(
  rp => rp.permission.key.startsWith('kxtill.')
);

for (const rp of kxTillPerms) {
  await roleDb.removePermissionFromRole(role.id, rp.permissionId);
}
```
Do NOT call `orgDb.updateMembership({ isActive: false })`.

### 2. Members with zero KxTill perms are invisible
Add `?includeAll=true` to `GET /kxtill/staff`.
Returns all members, with `permissions: []` for those without KxTill access.

### 3. No-role case
When `membership.roleId` is null, admin can't inject permissions.

**Decision needed:**
- [ ] Block with message: "Assign a role first. Go to /staff"
- [ ] Auto-create personal role: `POST /roles { name: "{firstName}'s Role" }`, then assign

## What's Still Missing

### Backend
- [ ] Fix `removeKxTillAccess` to strip kxtill.* only
- [ ] Add `includeAll` option to `getKxTillStaff`
- [ ] Handle no-role case (per decision above)
- [ ] Add `grantKxTillAccess` convenience method
      → resolves member's role → injects preset permission bundle

### Frontend
- [ ] `src/pages/KxTillStaff/ManagePermissionsModal.jsx`
- [ ] `src/pages/KxTillStaff/ManagePermissionsModal.module.css`
- [ ] Update `KxTillStaff.jsx`:
  - [ ] "Show all members" toggle
  - [ ] Row badge `No KxTill access` for zero-perm members
  - [ ] Action button label toggles:
        "Manage KxTill Permissions" (has perms) vs "Grant KxTill Access" (none)
  - [ ] Remove references to ChangeRoleModal
- [ ] Delete old `ChangeRoleModal.jsx` and `.module.css`

## Modal Design — "KxTill Permissions for {name}"

**Header:**
- Member name + email
- Current role name
- ⚠️ Warning: "Permissions are added to the {roleName} role.
  Everyone with this role will gain access."

**Body — grouped checkbox list:**

```
Sales
  ☐ Create Sales              kxtill.sales.create
  ☐ View Sales                kxtill.sales.view
  ☐ Refund Sales              kxtill.sales.refund
  ☐ Delete Sales              kxtill.sales.delete

Inventory
  ☐ View Inventory            kxtill.inventory.view
  ☐ Create Inventory          kxtill.inventory.create
  ☐ Update Inventory          kxtill.inventory.update
  ☐ Delete Inventory          kxtill.inventory.delete
  ☐ Create Transfers          kxtill.inventory.transfers.create
  ☐ Approve Transfers         kxtill.inventory.transfers.approve
  ☐ Complete Transfers        kxtill.inventory.transfers.complete

Customers
  ☐ View Customers            kxtill.customers.view
  ☐ Create Customers          kxtill.customers.create
  ☐ Update Customers          kxtill.customers.update
  ☐ Delete Customers          kxtill.customers.delete

Reports
  ☐ View Reports              kxtill.reports.view
  ☐ Export Reports            kxtill.reports.export

Settings
  ☐ View Settings             kxtill.settings.view
  ☐ Update Settings           kxtill.settings.update
```

**Preset buttons:**
- **Cashier** — sales.create, sales.view, inventory.view
- **Manager** — sales.create, sales.view, sales.refund, inventory.view,
  inventory.update, customers.view, customers.create, reports.view,
  settings.view, settings.update
- **Full KxTill** — every KxTill permission
- **Clear All** — uncheck everything

**Pre-checked:** permissions the member already has.
**Unchecked:** everything else.

## Save Behavior

Compute diff:
- **Additions** (checked, not currently granted) → `POST /roles/:roleId/permissions`
- **Removals** (unchecked, currently granted) → `PATCH /roles/:roleId/permissions` with new set

Sequential. Collect errors. Show toast:
- Success: "KxTill access updated — 3 added, 1 removed"
- Partial: "2 of 3 saved. Retry failed?"
- Failure: "Failed to update permissions"

Then refetch staff list.

## Decisions Pending

### 1. DELETE endpoint shape
Confirmed: use `PATCH /roles/:roleId/permissions` with updated set.

### 2. No-role case
- [ ] Block — "Assign a role first. Go to /staff"
- [ ] Auto-create personal role

### 3. Show-all approach
- [ ] Toggle on same page (`?includeAll=true`)
- [ ] Separate "Grant KxTill" flow with member picker

### 4. "Remove Access" button semantics
- [ ] Rename to "Remove KxTill Access" and strip kxtill.* perms
- [ ] Keep "Deactivate Member" as separate action (org-wide)

## Testing Checklist

- [ ] Owner opens /kxtill/staff → sees members with KxTill access
- [ ] Toggle "Show all members" → includes zero-perm members
- [ ] Zero-perm member shows badge + "Grant KxTill Access" button
- [ ] Modal for zero-perm member:
  - [ ] Warning shows correct role name
  - [ ] All boxes unchecked
  - [ ] "Cashier" preset checks right boxes
  - [ ] Save → permissions injected → member appears in default view
- [ ] Modal for existing KxTill member:
  - [ ] Current perms pre-checked
  - [ ] Uncheck one + Save → removal fired
- [ ] Presets work
- [ ] Partial failure → clear error toast
- [ ] Non-owner with `kxtill.staff.manage` → can use modal
- [ ] Non-owner without permission → buttons disabled
- [ ] Member with `roleId: null` → behavior matches decision 2
- [ ] Remove KxTill Access → member loses kxtill.*, stays in org

## Notes

- Roles are the grant unit. No per-user permission overrides.
- Warning text is essential — admins must know they're broadening
  access for everyone sharing the role.
- Presets keep it fast. Granular checks still available.
- Pattern matches KXBYTE's role model everywhere: role = bundle, bundle = grant.


