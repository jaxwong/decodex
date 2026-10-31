export function createShopeeLunaAdapter(openProduct, cartSelections, pickProduct) {
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
    // The product the shopper picked in Luna: the host puts it in the cart, ticked alone.
    async requestAddToCart(selection) {
      pickProduct(selection);
      return { ok: true };
    },
  };
}
