# Transfers — TODO

## Design note (read before changing anything)
Stock moves at **APPROVE**, not at COMPLETE.
- PENDING   — nothing has moved
- APPROVED  — stock deducted from source + added to destination
- COMPLETED — receiving branch confirms physical handoff

This is deliberate. UI copy in `TransferDetailModal` reflects it.
Do NOT change without a product decision.

## Verify after deploy
- [ ] Incoming transfers appear in branch transfer list
      (`findTransfersByOrganization` filters source OR dest)
- [ ] Stock delta lands in destination after approve
- [ ] Platform fallback (`branches.manage`) works on backend
- [ ] Non-owner with `kxtill.inventory.transfers.approve` can approve
- [ ] Non-owner without approve permission sees 403

### Test matrix
| Role | Expected |
|------|----------|
| owner | all actions |
| manager (transfers.approve) | all actions |
| clerk (transfers.create only) | create only |
| platform admin (branches.manage) | all actions |
| cashier (sales.create only) | read-only |

## Deferred (not in this release)
- [ ] Notifications on transfer create / approve
- [ ] Separate `kxtill.inventory.transfers.reject` permission key
- [ ] Backend stats endpoint honours `branchId`