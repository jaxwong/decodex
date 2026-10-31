export function createShopeeLunaAdapter(navigate) {
  return {
    hostId: 'shopee-compare-app',
    getCurrentSelection() {
      return null;
    },
    onSelectionChange() {
      return () => {};
    },
    navigateToListing(listingId) {
      navigate(`/Compare?listing_id=${encodeURIComponent(listingId)}`);
    },
  };
}
