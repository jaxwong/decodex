export function createShopeeLunaAdapter(openProduct, cartSelections, pickProduct, checkOutProduct) {
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
    // Shopee's checkout for that one picked variant, only on the shopper's explicit press.
    async requestCheckout(selection) {
      checkOutProduct(selection);
      return { ok: true };
    },
  };
}
