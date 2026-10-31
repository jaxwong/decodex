export function createShopeeLunaAdapter(openProduct, cartSelections, checkOutProduct) {
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
    // Shopee's "Buy Now" for the product the shopper chose in Luna: check out only that variant.
    async requestAddToCart(selection) {
      checkOutProduct(selection);
      return { ok: true };
    },
  };
}
