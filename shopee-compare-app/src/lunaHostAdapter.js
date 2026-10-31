export function createShopeeLunaAdapter(openProduct) {
  return {
    hostId: 'shopee-compare-app',
    getCurrentSelection() {
      return null;
    },
    onSelectionChange() {
      return () => {};
    },
    navigateToListing(product) {
      openProduct(product);
    },
  };
}
