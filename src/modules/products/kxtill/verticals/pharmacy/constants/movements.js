// src/modules/products/kxtill/verticals/pharmacy/constants/movements.js
//
// Every mutation to a batch's stock writes a KxTillPharmacyStockMovement row.
// The movementType tells the audit trail why the quantity changed.
//
// NOTE: Transfer movements (TRANSFERRED_OUT, TRANSFERRED_IN) are written by the
// pharmacy transfer hook that plugs into Core's existing KxTillTransfer flow.
// Pharmacy does NOT own a separate transfer system.

export const MOVEMENT_TYPES = Object.freeze({
  RECEIVED: 'RECEIVED',                       // stock arrived from supplier
  SOLD: 'SOLD',                               // consumed by a sale
  TRANSFERRED_OUT: 'TRANSFERRED_OUT',         // sent to another branch (via Core transfer)
  TRANSFERRED_IN: 'TRANSFERRED_IN',           // received from another branch (via Core transfer)
  RETURNED_TO_SUPPLIER: 'RETURNED_TO_SUPPLIER',
  DAMAGED: 'DAMAGED',                         // broken/lost
  EXPIRED: 'EXPIRED',                         // wrote off due to expiry
  ADJUSTED: 'ADJUSTED',                       // manual stock count correction
  QUARANTINED: 'QUARANTINED',                 // held aside, not sellable
  RECALLED: 'RECALLED',                       // manufacturer recall
  REFUNDED: 'REFUNDED',                       // refunded to customer (via sale refund)
});

export const MOVEMENT_TYPE_LIST = Object.freeze(Object.values(MOVEMENT_TYPES));

// Movement types that increase batch stock (positive quantity).
export const INBOUND_MOVEMENTS = Object.freeze([
  MOVEMENT_TYPES.RECEIVED,
  MOVEMENT_TYPES.TRANSFERRED_IN,
  MOVEMENT_TYPES.REFUNDED,
]);

// Movement types that decrease batch stock (positive quantity, but treated as out).
export const OUTBOUND_MOVEMENTS = Object.freeze([
  MOVEMENT_TYPES.SOLD,
  MOVEMENT_TYPES.TRANSFERRED_OUT,
  MOVEMENT_TYPES.RETURNED_TO_SUPPLIER,
  MOVEMENT_TYPES.DAMAGED,
  MOVEMENT_TYPES.EXPIRED,
  MOVEMENT_TYPES.RECALLED,
]);