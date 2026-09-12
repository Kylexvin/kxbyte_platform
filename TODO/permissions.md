# Permissions — TODO

New `PermissionsContext` is the source of truth for permission checks.

## Migrate screens
Currently use `userPermissions?.includes('*')` — resolves to `undefined`
because AuthContext doesn't expose it, so `isOwner` is silently false
in some flows.

- [ ] `Transfers.jsx`
- [ ] `Inventory.jsx`
- [ ] `GlobalInventory.jsx`
- [ ] Any other screen using `userPermissions`

### Replace
```js
const isOwner = userPermissions?.includes('*') || false;
With

const { isOwner } = usePermissions();
Route-level permission gates
Sidebar hides links, but direct URL navigation still works.

Add per-page access checks. Pattern:


import { usePermissions } from '../../contexts/PermissionsContext';

const { can } = usePermissions();
if (!can('kxtill.reports.view')) {
  return <NoAccess />;
}
□ Reports
□ Settings
□ Branches
□ Roles
□ Staff
text

