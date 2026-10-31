export function createMinimalHostAdapter(onNavigate) {
  let selection = null;
  const subscribers = new Set();
  return {
    adapter: {
      hostId: 'minimal-host',
      getCurrentSelection() {
        return selection;
      },
      onSelectionChange(subscriber) {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
      navigateToListing(product) {
        onNavigate(product);
      },
    },
    select(nextSelection) {
      selection = nextSelection;
      for (const subscriber of subscribers) subscriber(selection);
    },
  };
}
