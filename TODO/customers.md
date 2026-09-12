# Customers — TODO

## Done
- [x] List page: `/customers`
- [x] Detail page: `/customers/:id`
- [x] Create modal
- [x] Edit modal (KxTill-created only)
- [x] Archive (KxTill-created only)
- [x] Sidebar flat link
- [x] Permission keys: `customers.view`, `customers.create`, `customers.update`, `customers.delete`

## Rule
KxTill only edits customers where `createdByProduct === 'kxtill'`.
Everything else is read-only in KxTill (edit belongs to KxCRM).

## Verify
- [ ] Owner sees Edit + Archive on KxTill customers
- [ ] Non-KxTill customer shows neither
- [ ] Non-owner without `customers.update` sees no Pencil
- [ ] Non-owner without `customers.delete` sees no Archive
- [ ] Archive → redirect to list → customer gone
- [ ] Direct URL to archived customer shows Inactive badge