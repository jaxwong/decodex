export function createShopeeLunaAdapter(openProduct, cartSelections) {
  return {
    hostId: 'shopee-compare-app',
    getCurrentSelections() {
      return cartSelections;
    },
    onSelectionChange() {
      return () => {};
    },
    navigateToListing(product) {
      openProduct(product);
    },
  };
}
