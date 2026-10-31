const requiredFunctions = [
  'getCurrentSelection',
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
  if (adapter.requestAddToCart !== undefined && typeof adapter.requestAddToCart !== 'function') {
    throw new TypeError('Luna host adapter requestAddToCart must be a function when provided');
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
