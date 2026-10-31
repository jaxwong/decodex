const requiredFunctions = [
  'getCurrentSelections',
  'onSelectionChange',
  'navigateToListing',
];

export function assertHostAdapter(adapter) {
  if (!adapter || typeof adapter.hostId !== 'string' || !adapter.hostId.trim()) {
    throw new TypeError('Luna host adapter requires a non-empty hostId');
  }
  for (const functionName of requiredFunctions) {
    if (typeof adapter[functionName] !== 'function') {
      throw new TypeError(`Luna host adapter requires ${functionName}()`);
    }
  }
  for (const optionalName of ['requestAddToCart', 'requestCheckout']) {
    if (adapter[optionalName] !== undefined && typeof adapter[optionalName] !== 'function') {
      throw new TypeError(`Luna host adapter ${optionalName} must be a function when provided`);
    }
  }
  if (adapter.requestCheckout !== undefined && adapter.requestAddToCart === undefined) {
    throw new TypeError('Luna host adapter requestCheckout needs requestAddToCart: a pick comes before checkout');
  }
  return adapter;
}

export function selectionKey(selection) {
  if (selection === null) return null;
  if (
    !selection
    || typeof selection.listingId !== 'string'
    || !selection.listingId
    || typeof selection.variantId !== 'string'
    || !selection.variantId
  ) {
    throw new TypeError('Host selection requires listingId and variantId');
  }
  return `${selection.listingId}:${selection.variantId}`;
}

// The comparison bucket holds at most four exact variants, so a host may hand over at most four.
export function selectionKeys(selections) {
  if (!Array.isArray(selections) || selections.length > 4 || selections.includes(null)) {
    throw new TypeError('Host selections must be an array of at most 4 { listingId, variantId } objects');
  }
  return selections.map(selectionKey);
}
