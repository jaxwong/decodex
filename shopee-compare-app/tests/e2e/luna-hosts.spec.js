import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '../../..');

async function openLuna(page, projectName) {
  if (projectName === 'host-a-chromium') {
    await page.goto('/#/Cart');
    await page.getByRole('button', { name: 'Compare now' }).click();
    await expect(page).toHaveURL(/#\/Compare$/);
    await expect(page.getByRole('heading', { name: 'Shopee Compare' })).toBeVisible();
    return;
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Plain product shortlist' })).toBeVisible();
}

test('same packaged widget completes add, compare, ask, cite, and voice fallback', async ({ page }, testInfo) => {
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        throw new DOMException('Permission denied by deterministic E2E test', 'NotAllowedError');
      },
    });
  });

  await openLuna(page, testInfo.project.name);
  const widget = page.getByRole('region', { name: 'Luna shopping assistant' });
  const needs = page.getByRole('region', { name: 'Your needs' });
  const sourcePanel = page.getByRole('dialog');
  // Host A's cart hands Luna these same three variants, so Host A opens straight on the table.
  if (testInfo.project.name === 'host-b-chromium') {
    await expect(page.getByRole('heading', { name: 'Pick 2–4 products to compare' })).toBeVisible();
    const firstVariant = page.getByRole('checkbox', {
      name: /100W.*List SGD 60\.00.*Shipping \+SGD 15\.00/,
    });
    await expect(firstVariant).toBeVisible();
    await page.getByRole('button', { name: 'Select 100W · SGD 60.00' }).click();
    await expect(firstVariant).toBeChecked();
    await page.getByRole('checkbox', { name: /65W.*Shipping \+SGD 17\.00/ }).check();
    await page.getByRole('checkbox', { name: /87W.*Shipping \+SGD 3\.00/ }).check();
    await page.getByRole('button', { name: 'Compare 3 products' }).click();
  }

  await expect(widget).toHaveAttribute('data-revision', '0');
  await expect(page.getByRole('table', { name: 'Product comparison' })).toBeVisible();
  await expect(page.getByText('Sticker prices can mislead.')).toBeVisible();
  await expect(page.getByText('Assumes listed shipping and shop voucher.')).toBeVisible();
  await page.getByRole('button', {
    name: /Delivered price for Breeze Slim .*: SGD 81\.65/,
  }).click();
  await expect(sourcePanel.getByText('List price')).toBeVisible();
  await expect(sourcePanel.getByText('Shop voucher', { exact: true })).toBeVisible();
  await expect(sourcePanel.getByText('Shipping', { exact: true })).toBeVisible();
  await expect(sourcePanel.getByText('Delivered total', { exact: true })).toBeVisible();
  await expect(sourcePanel.getByText('SGD 69.65')).toBeVisible();
  await expect(sourcePanel.getByText('SGD 81.65')).toHaveCount(2);
  await sourcePanel.getByRole('button', { name: 'Close', exact: true }).click();
  // Host B keeps Luna's cited product preview; Host A shows its own storefront page.
  if (testInfo.project.name === 'host-b-chromium') {
    await page.getByRole('button', { name: 'View product' }).first().click();
    const productView = page.getByRole('region', { name: 'Host product view' });
    await expect(productView.getByRole('heading', { name: 'Atlas Portable Power Bank' })).toBeVisible();
    await expect(productView.getByText('100W', { exact: true })).toBeVisible();
    await expect(productView.getByText('Delivered SGD 75.00', { exact: true })).toBeVisible();
    const priceBreakdown = productView.locator('dl[aria-label="Price breakdown"]');
    await expect(priceBreakdown).toContainText('List priceSGD 60.00');
    await expect(priceBreakdown).toContainText('Shop voucher− SGD 0.00');
    await expect(priceBreakdown).toContainText('Shipping+ SGD 15.00');
    await expect(priceBreakdown).toContainText('Delivered totalSGD 75.00');
    const priceSources = productView.getByRole('list', { name: 'Sources for price' });
    await expect(priceSources.getByRole('listitem')).toHaveCount(3);
    for (const [text, location] of [
      ['List price: SGD 60.00', 'variants/100w/price_minor'],
      ['Shop voucher: SGD 0.00', 'variants/100w/shop_voucher_minor'],
      ['Shipping: SGD 15.00', 'variants/100w/shipping_minor'],
    ]) {
      await expect(priceSources.getByText(text, { exact: true })).toBeVisible();
      await expect(priceSources.getByText(location, { exact: true })).toBeVisible();
    }
    const specifications = productView.getByRole('list', { name: 'Product specifications' });
    const specificationRows = specifications.locator(':scope > li');
    await expect(specificationRows).toHaveCount(8);
    for (const [label, value] of [
      ['Capacity', '20,000 mAh'],
      ['Max output', '100 W'],
      ['USB-C ports', '2'],
      ['Weight', '420 g'],
      ['Max input', '65 W'],
      ['USB PD', 'Yes'],
      ['Included cable', 'Yes'],
      ['Warranty', '12 months'],
    ]) {
      const specification = specificationRows.filter({ hasText: label });
      await expect(specification.getByText(value, { exact: true })).toBeVisible();
    }
    const capacity = specificationRows.filter({ hasText: 'Capacity' });
    const capacitySources = capacity.getByRole('list', { name: 'Sources for Capacity' });
    await expect(capacitySources.getByRole('listitem')).toHaveCount(1);
    await expect(capacitySources.getByText('Spec table', { exact: true })).toBeVisible();
    await expect(capacitySources.getByText('Capacity: 20 Ah', { exact: true })).toBeVisible();
    await expect(capacitySources.getByText('variants/100w/attributes/0', { exact: true })).toBeVisible();
    await productView.getByRole('button', { name: 'Close product view' }).click();
    await expect(productView).toHaveCount(0);
    await expect(widget).toHaveAttribute('data-revision', '0');

    await page.getByRole('button', { name: 'View product' }).last().click();
    await expect(productView.getByRole('heading', { name: 'Comet Travel Power Bank' })).toBeVisible();
    const cometSpecifications = productView.getByRole('list', { name: 'Product specifications' });
    const cometSpecificationRows = cometSpecifications.locator(':scope > li');
    const missingWeight = cometSpecificationRows.filter({ hasText: 'Weight' });
    await expect(missingWeight.getByText('Not stated', { exact: true })).toBeVisible();
    await expect(missingWeight.getByText('No verified seller source. Luna does not guess.', { exact: true })).toBeVisible();
    const conflictingWarranty = cometSpecificationRows.filter({ hasText: 'Warranty' });
    await expect(conflictingWarranty.getByText('Listing disagrees: 12 vs 24 months', { exact: true })).toBeVisible();
    const warrantySources = conflictingWarranty.getByRole('list', { name: 'Sources for Warranty' });
    await expect(warrantySources.getByRole('listitem')).toHaveCount(2);
    await expect(warrantySources.getByText('Warranty: 1 year', { exact: true })).toBeVisible();
    await expect(warrantySources.getByText('Warranty: 24 months', { exact: true })).toBeVisible();
    await productView.getByRole('button', { name: 'Close product view' }).click();
    await expect(productView).toHaveCount(0);
  } else {
    // Host A opens its Shopee product page over the comparison; closing it keeps the comparison.
    await page.getByRole('button', { name: 'View product' }).first().click();
    const productPage = page.getByRole('dialog', { name: 'Product page' });
    await expect(productPage.getByRole('heading', { name: 'Atlas Portable Power Bank', level: 1 })).toBeVisible();
    await expect(productPage.getByRole('img', { name: 'Atlas Portable Power Bank' })).toBeVisible();
    await expect(productPage.getByLabel('Price')).toHaveText('SGD 60.00');
    await expect(productPage.getByRole('button', { name: '100W', pressed: true })).toBeVisible();
    await expect(productPage.getByRole('region', { name: 'Product Specifications' })).toContainText('Capacity20 Ah');
    await productPage.getByRole('button', { name: '< Back to comparison' }).click();
    await expect(productPage).toHaveCount(0);
    await expect(widget).toHaveAttribute('data-revision', '0');
  }
  await page.getByRole('button', { name: /^Warranty for Comet Travel .*: Listing disagrees, 12 vs 24 months$/ }).click();
  await expect(sourcePanel.getByText('Listing disagrees with itself')).toBeVisible();
  await expect(sourcePanel.getByText('Warranty: 1 year')).toBeVisible();
  await expect(sourcePanel.getByText('Warranty: 24 months')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sourcePanel).toHaveCount(0);

  const disputeMarkers = page.locator('.luna-dispute-marker');
  await expect(disputeMarkers).toHaveCount(1);
  const disputedCapacity = page.getByRole('button', {
    name: /^Capacity for Breeze Slim .*: 20,000 mAh, disputed in 2 of 16 reviews analysed$/,
  });
  await expect(disputedCapacity).toContainText('Disputed in 2 of 16 reviews analysed');
  await disputedCapacity.click();
  await expect(sourcePanel.getByText('From the listing · disputed in reviews')).toBeVisible();
  await expect(sourcePanel.getByText('Capacity: 20 Ah')).toBeVisible();
  const reviewQuotes = sourcePanel.getByRole('region', { name: 'Disputed in analysed reviews' });
  await expect(reviewQuotes.getByText('Customer review · listingB-r19')).toBeVisible();
  await expect(reviewQuotes.getByText('“Charges my phone twice, nowhere near 20000mAh”')).toBeVisible();
  await expect(reviewQuotes.getByText('Customer review · listingB-r20')).toBeVisible();
  // The reviewer's Vietnamese is quoted as written, diacritics included, never translated.
  await expect(reviewQuotes.getByText(
    '“Chỉ sạc đầy điện thoại được hai lần, không được 20000mAh như quảng cáo”',
  )).toBeVisible();
  await expect(sourcePanel.getByText(/count among reviews analysed, not a defect rate/)).toBeVisible();
  await sourcePanel.getByRole('button', { name: 'Ask Luna about this' }).click();
  await expect(page.getByLabel('Message Luna'))
    .toHaveValue('Is the capacity claim for Breeze Slim Power Bank · 65W reliable?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Luna cannot verify the true figure/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Source: .*review: “Charges my phone twice/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Source: .*review: “Chỉ sạc đầy điện thoại được hai lần/ })).toBeVisible();
  await expect(widget).toHaveAttribute('data-revision', '0');
  await expect(disputedCapacity).toContainText('20,000 mAh');

  await page.getByLabel('Message Luna').fill(
    'Under S$80, at least 65W, prioritize portability.',
  );
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(widget).toHaveAttribute('data-revision', '1');
  await expect(page.getByText(/Budget applied to delivered prices/)).toBeVisible();
  await expect(needs.getByText('Up to SGD 80.00')).toBeVisible();
  await expect(page.getByRole('columnheader').filter({ hasText: 'Breeze Slim' }))
    .toContainText('Doesn’t fit your needs');
  await expect(page.getByRole('status').filter({ hasText: 'Updated to match your needs.' })).toBeVisible();
  // The disputed-capacity answer above also has sources; the budget answer is the latest.
  await page.getByRole('button', { name: /^Source: / }).last().click();
  await expect(sourcePanel.getByText('Variant details')).toBeVisible();
  await expect(sourcePanel.getByText('Shipping: SGD 17.00')).toBeVisible();
  await sourcePanel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sourcePanel).toHaveCount(0);

  await page.getByLabel('Message Luna').fill('Actually price first.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(widget).toHaveAttribute('data-revision', '2');
  await expect(needs.getByText('Priority 1: Delivered price')).toBeVisible();

  await page.getByLabel('Message Luna').fill('Set my budget to S$70 and keep price first.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(widget).toHaveAttribute('data-revision', '3');
  await expect(needs.getByText('Up to SGD 70.00')).toBeVisible();
  // Seller insights belong to Seller Centre; an excluded product shows buyers nothing seller-side.
  await expect(page.getByRole('columnheader').filter({ hasText: 'Comet Travel' })
    .getByText('Doesn’t fit your needs')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seller view' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Microphone permission was denied. Text chat remains available.')).toBeVisible();
  await expect(page.getByLabel('Message Luna')).toBeEnabled();
  expect(consoleErrors).toEqual([]);
});

test('Host A cart lists catalog variants and compares the ticked ones in Luna', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'host-a-chromium', 'The cart is a Host A storefront page');
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const atlas = page.getByRole('checkbox', { name: /100W.*Shipping \+SGD 15\.00/ });
  const breeze = page.getByRole('checkbox', { name: /65W.*Shipping \+SGD 17\.00/ });
  const comet = page.getByRole('checkbox', { name: /87W.*Shipping \+SGD 3\.00/ });

  await page.goto('/#/Cart');
  const cart = page.getByRole('region', { name: 'Cart products' });
  for (const [name, price] of [
    ['Atlas Portable Power Bank 100W', 'SGD 60.00'],
    ['Breeze Slim Power Bank 65W', 'SGD 69.65'],
    ['Comet Travel Power Bank 87W', 'SGD 79.87'],
  ]) {
    await expect(cart.getByRole('checkbox', { name: `Select ${name}` })).toBeChecked();
    await expect(cart.locator('article').filter({ hasText: price })).toHaveCount(1);
  }
  await expect(page.getByText('Total (3 items):')).toContainText('SGD 209.52');

  const tickBreeze = cart.getByRole('checkbox', { name: 'Select Breeze Slim Power Bank 65W' });
  const tickComet = cart.getByRole('checkbox', { name: 'Select Comet Travel Power Bank 87W' });

  // Two or more ticked products are a full comparison, so Luna opens straight on the table.
  // While the real API builds it (seconds), the shopper sees those products loading, never the
  // picker; hold the request open to observe that state.
  let releaseComparison;
  const comparisonHeld = new Promise(resolve => { releaseComparison = resolve; });
  await page.route('**/api/comparisons', async route => {
    await comparisonHeld;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Compare now' }).click();
  await expect(page).toHaveURL(/#\/Compare$/);
  const opening = page.getByRole('status').filter({ hasText: 'Lining up your 3 products…' });
  await expect(opening).toBeVisible();
  for (const name of ['Atlas Portable Power Bank · 100W', 'Breeze Slim Power Bank · 65W', 'Comet Travel Power Bank · 87W']) {
    await expect(opening.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Pick 2–4 products to compare' })).toHaveCount(0);
  releaseComparison();
  await expect(page.getByRole('heading', { name: 'Comparing 3 products' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Product comparison' })).toBeVisible();
  await expect(opening).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pick 2–4 products to compare' })).toHaveCount(0);
  await page.unroute('**/api/comparisons');

  // Luna asks for exactly the ticked products. This request meets a simulated outage, so the
  // picker stays open with the picks.
  await page.getByRole('link', { name: '< Back to Cart' }).click();
  await tickBreeze.uncheck();
  let requestedItems = null;
  await page.route('**/api/comparisons', route => {
    requestedItems = route.request().postDataJSON().items;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'Catalog provider is unavailable.' } }),
    });
  });
  await page.getByRole('button', { name: 'Compare now' }).click();
  await expect(page.getByRole('alert')).toHaveText('Luna ran into a problem on our side. Please try again in a moment.');
  expect(requestedItems).toEqual([
    { listing_id: 'listingA', variant_id: '100w' },
    { listing_id: 'listingC', variant_id: '87w' },
  ]);
  await expect(atlas).toBeChecked();
  await expect(comet).toBeChecked();
  await expect(breeze).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Compare 2 products' })).toBeEnabled();
  await page.unroute('**/api/comparisons');
  // The outage above logs its expected request errors; everything after it must stay clean.
  consoleErrors.length = 0;

  // One product cannot be compared alone, so Luna shows the picker with it already picked.
  await page.getByRole('link', { name: '< Back to Cart' }).click();
  await tickBreeze.uncheck();
  await tickComet.uncheck();
  await page.getByRole('button', { name: 'Compare now' }).click();
  await expect(page.getByRole('heading', { name: 'Pick 2–4 products to compare' })).toBeVisible();
  await expect(atlas).toBeChecked();
  await expect(breeze).not.toBeChecked();
  await expect(comet).not.toBeChecked();
  await expect(page.getByText('1 of 4 picked')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Compare 1 product/ })).toBeDisabled();

  await page.getByRole('link', { name: '< Back to Cart' }).click();
  await page.getByRole('checkbox', { name: /^Select All/ }).uncheck();
  await page.getByRole('button', { name: 'Compare now' }).click();
  await expect(page.getByRole('heading', { name: 'Pick 2–4 products to compare' })).toBeVisible();
  await expect(atlas).toBeVisible();
  await expect(atlas).not.toBeChecked();
  await expect(page.getByText('0 of 4 picked')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('Host A search and product page add an exact model to the cart', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'host-a-chromium', 'Search and product pages are Host A storefront pages');
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/#/');
  const searchBox = page.getByRole('searchbox', { name: 'Search products' });
  await searchBox.fill('iPhone');
  await searchBox.press('Enter');
  await expect(page.getByText("No results for 'iPhone'.")).toBeVisible();
  await searchBox.fill('power bank');
  await searchBox.press('Enter');
  await expect(page).toHaveURL(/#\/Search\?q=power%20bank$/);
  const results = page.getByRole('list', { name: 'Search results' });
  await expect(results.getByRole('listitem')).toHaveCount(3);
  await expect(results.locator('img')).toHaveCount(3);
  await results.getByRole('link', { name: /Breeze Slim Power Bank/ }).click();

  // Before a model is picked the page shows the listing's price range and cannot add to cart.
  await expect(page).toHaveURL(/#\/Product\/listingB$/);
  await expect(page.getByRole('heading', { name: 'Breeze Slim Power Bank', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Price')).toHaveText('SGD 69.45 – SGD 70.30');
  await expect(page.getByRole('button', { name: 'Add To Cart' })).toBeDisabled();
  const ratings = page.getByRole('region', { name: 'Product Ratings' });
  await expect(ratings).toContainText('3.2 out of 5');
  await ratings.getByRole('button', { name: '2 Star (10)' }).click();
  await expect(ratings.getByRole('list', { name: 'Reviews' }).getByRole('listitem')).toHaveCount(6);
  await ratings.getByRole('button', { name: 'Review page 2' }).click();
  await expect(ratings.getByRole('list', { name: 'Reviews' }).getByRole('listitem')).toHaveCount(4);

  await page.getByRole('group', { name: 'Model' }).getByRole('button', { name: '100W' }).click();
  await expect(page).toHaveURL(/#\/Product\/listingB\?variant=100w$/);
  await expect(page.getByLabel('Price')).toHaveText('SGD 70.00');
  await expect(page.getByText('SGD 5.00 OFF')).toBeVisible();
  await expect(page.getByText('Shipping fee SGD 17.00')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Product Specifications' })).toContainText('Weight310 g');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Add To Cart' }).click();
  await expect(page.getByRole('status')).toContainText('Added 2 × 100W to your cart.');
  await expect(page.getByRole('link', { name: 'Cart, 4 items' })).toBeVisible();

  await page.getByRole('link', { name: 'View cart' }).click();
  const added = page.getByRole('region', { name: 'Cart products' }).locator('article')
    .filter({ hasText: 'Variation: 100W' }).filter({ hasText: 'Breeze Slim Power Bank' });
  await expect(added).toContainText('SGD 140.00');
  await added.getByRole('link', { name: /Breeze Slim Power Bank/ }).click();
  await expect(page).toHaveURL(/#\/Product\/listingB\?variant=100w$/);
  await expect(page.getByRole('button', { name: '100W', pressed: true })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('Host A checks out the cart or the product chosen in Luna', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'host-a-chromium', 'Checkout is a Host A storefront page');
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const ordered = page.getByRole('region', { name: 'Products ordered' });
  const summary = page.locator('dl[aria-label="Order summary"]');

  // Each listing's voucher and shipping apply once to its order line.
  await page.goto('/#/Cart');
  await page.getByRole('button', { name: 'Check Out' }).click();
  await expect(ordered.getByRole('article')).toHaveCount(3);
  await expect(summary).toContainText('Merchandise SubtotalSGD 209.52');
  await expect(summary).toContainText('Shipping TotalSGD 35.00');
  await expect(summary).toContainText('Shop Voucher Discount−SGD 15.00');
  await expect(summary).toContainText('Total PaymentSGD 229.52');

  await page.goto('/#/Cart');
  await page.getByRole('button', { name: 'Compare now' }).click();
  await expect(page.getByRole('table', { name: 'Product comparison' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose Comet Travel Power Bank · 87W' }).click();
  await expect(page).toHaveURL(/#\/Checkout$/);
  await expect(ordered.getByRole('article')).toHaveCount(1);
  await expect(ordered).toContainText('Comet Travel Power Bank');
  await expect(ordered).toContainText('Variation: 87W');
  // One unit at checkout costs exactly Luna's delivered total for that variant.
  await expect(summary).toContainText('Total PaymentSGD 72.87');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Ordered products' })).toContainText('Comet Travel Power Bank · 87W');
  await expect(page.getByText('Total Payment SGD 72.87')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('Seller Centre counts an excluded listing from another buyer session', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'host-a-chromium', 'Seller Centre is a Host A storefront page');
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  // Every test shares one API process, so count from what is already there.
  const { token } = await (await request.post('/api/demo-sessions')).json();
  const baseline = await (await request.get('/api/listings/listingC/gap-report', {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const comparisons = baseline.comparisons_count + 1;
  const overBudget = (baseline.exclusion_counts.over_budget ?? 0) + 1;

  // The cart's three ticked products open straight on one comparison.
  await openLuna(page, testInfo.project.name);
  const widget = page.getByRole('region', { name: 'Luna shopping assistant' });
  await expect(widget).toHaveAttribute('data-revision', '0');
  await page.getByLabel('Message Luna').fill('Set my budget to S$70.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(widget).toHaveAttribute('data-revision', '1');

  await page.getByRole('banner').getByRole('link', { name: 'Seller Centre' }).click();
  await expect(page).toHaveURL(/#\/SellerCentre$/);
  const seller = page.getByRole('region', { name: 'Luna seller insights' });
  await expect(seller.getByText('Demo seller view. There is no seller login')).toBeVisible();
  await seller.getByRole('button', { name: 'Comet Travel Power Bank' }).click();
  const report = seller.getByRole('region', { name: 'Seller report' });
  await expect(report.getByText(`In ${comparisons} buyer comparison${comparisons === 1 ? '' : 's'}`)).toBeVisible();
  await expect(report.getByText(`Over budget: ${overBudget}`)).toBeVisible();
  await expect(report.getByText('Weight', { exact: true })).toBeVisible();
  const warrantyText = report.getByRole('list', { name: 'Your listing text for Warranty' });
  await expect(warrantyText.getByText('Warranty: 1 year')).toBeVisible();
  await expect(warrantyText.getByText('Warranty: 24 months')).toBeVisible();
  await expect(report.getByText('Weight: Atlas Portable')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('a missing value becomes a seller-confirmed source after one simulated seller answer', async ({ page }, testInfo) => {
  // Seller answers persist in the shared test API, so one host proves the flow on a variant
  // (Comet 100W) that no other test compares.
  test.skip(testInfo.project.name !== 'host-a-chromium', 'Shared package needs one seller-loop proof');
  const consoleErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const widget = page.getByRole('region', { name: 'Luna shopping assistant' });
  const cometWeight = /^Weight for Comet Travel Power Bank · 100W: /;

  await page.goto('/#/Compare');
  await page.getByRole('checkbox', { name: /100W.*Shipping \+SGD 15\.00/ }).check();
  await page.getByRole('checkbox', { name: /100W.*Shipping \+SGD 3\.00/ }).check();
  await page.getByRole('button', { name: 'Compare 2 products' }).click();
  await expect(page.getByRole('button', { name: cometWeight })).toContainText('Not stated');

  await page.getByRole('button', {
    name: 'Ask the seller about Weight for Comet Travel Power Bank · 100W',
  }).click();
  const confirm = page.getByRole('dialog', { name: 'Ask the seller' });
  await expect(confirm.getByText('“What is the Weight (g) of the 100W model?”')).toBeVisible();
  await confirm.getByRole('button', { name: 'Send to seller' }).click();

  const inbox = page.getByRole('region', { name: 'Simulated seller inbox' });
  await expect(inbox.getByRole('note')).toHaveText('Simulated seller. In production this is Seller Centre chat.');
  await expect(inbox.getByText('Field: Weight')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Product comparison' })).toHaveCount(0);
  await inbox.getByLabel('Weight (g)').fill('about 200');
  await inbox.getByRole('button', { name: 'Send answer' }).click();
  await expect(page.getByRole('alert'))
    .toContainText('Answer with one value in the unit the question asks for, for example 198.');
  await expect(inbox).toBeVisible();
  // The rejected answer above logs its expected request error; everything after must stay clean.
  consoleErrors.length = 0;

  await inbox.getByLabel('Weight (g)').fill('198');
  await inbox.getByRole('button', { name: 'Send answer' }).click();
  await expect(inbox).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(widget).toHaveAttribute('data-revision', '0');
  const answeredWeight = page.getByRole('button', { name: /^Weight for Comet Travel .*100W.*: 198 g, confirmed by seller$/ });
  await expect(answeredWeight).toContainText('Confirmed by seller');
  await expect(page.getByRole('button', { name: /^Ask the seller about Weight/ })).toHaveCount(0);
  await expect(page.getByText(/The seller answered “Weight: 198 g”/)).toBeVisible();

  await answeredWeight.click();
  const sourcePanel = page.getByRole('dialog');
  await expect(sourcePanel.locator('.luna-status')).toHaveText('Confirmed by seller');
  await expect(sourcePanel.locator('.luna-quote-from')).toHaveText('Confirmed by seller');
  await expect(sourcePanel.getByText('Weight: 198 g')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Source: .*Weight: 198 g/ }).click();
  await expect(sourcePanel.getByRole('heading', { name: /^Weight · Comet Travel/ })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('a session the API has forgotten never blocks the shopper', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'host-a-chromium', 'Shared package needs one session-renewal proof');
  const forgottenSession = {
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'SESSION_REQUIRED', message: 'A valid demo session bearer token is required.' } }),
  };
  let sessionsCreated = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/demo-sessions')) sessionsCreated += 1;
  });
  let compareRejected = false;
  await page.route('**/api/comparisons', async route => {
    if (compareRejected || route.request().method() !== 'POST') return route.fallback();
    compareRejected = true;
    return route.fulfill(forgottenSession);
  });

  // Open Luna without cart picks, so the shopper's own Compare press meets the forgotten session.
  await page.goto('/#/Compare');
  await page.getByRole('checkbox', { name: /100W.*Shipping \+SGD 15\.00/ }).check();
  await page.getByRole('checkbox', { name: /65W.*Shipping \+SGD 17\.00/ }).check();
  await page.getByRole('checkbox', { name: /87W.*Shipping \+SGD 3\.00/ }).check();
  // React development mode may run the widget's start-up twice, so count from here.
  const sessionsAtStart = sessionsCreated;
  await page.getByRole('button', { name: 'Compare 3 products' }).click();
  await expect(page.getByRole('table', { name: 'Product comparison' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(compareRejected).toBe(true);
  expect(sessionsCreated).toBe(sessionsAtStart + 1);

  await page.route('**/api/comparisons/*/ask', route => route.fulfill(forgottenSession));
  await page.getByLabel('Message Luna').fill('Cheapest first');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Luna restarted, so this comparison was cleared. Your products are still picked. Press Compare to build it again.',
  );
  await expect(page.getByRole('checkbox', { name: /100W.*Shipping \+SGD 15\.00/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /65W.*Shipping \+SGD 17\.00/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /87W.*Shipping \+SGD 3\.00/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Compare 3 products' })).toBeEnabled();
  expect(sessionsCreated).toBe(sessionsAtStart + 2);
});

test('Live WebRTC UI waits for readiness, captions, mute, and graceful close', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'host-a-chromium', 'Shared package needs one transport lifecycle proof');
  let postedOffer = '';
  await page.route('**/api/comparisons/*/live/session', async route => {
    postedOffer = route.request().postDataJSON().sdp;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        session: { id: 'live_e2e' },
        transport: { type: 'webrtc', sdp: 'deterministic-answer' },
      }),
    });
  });
  await page.addInitScript(() => {
    window.__lunaLiveSentEvents = [];
    window.__lunaTrackStopped = false;
    window.__lunaDataChannelLabel = '';
    const track = {
      stop() {
        window.__lunaTrackStopped = true;
      },
    };
    const stream = {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => stream,
    });

    class FakeDataChannel extends EventTarget {
      constructor(label) {
        super();
        this.label = label;
        this.readyState = 'open';
      }
      close() {
        this.readyState = 'closed';
      }
      send(serializedEvent) {
        const event = JSON.parse(serializedEvent);
        window.__lunaLiveSentEvents.push(event);
        if (event.type === 'session.close') {
          setTimeout(() => this.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({ type: 'session.closed' }),
          })), 0);
        }
      }
    }

    class FakePeerConnection extends EventTarget {
      constructor() {
        super();
        this.connectionState = 'new';
        this.iceGatheringState = 'complete';
        this.localDescription = null;
      }
      addTrack() {}
      close() {
        this.connectionState = 'closed';
      }
      createDataChannel(label) {
        window.__lunaDataChannelLabel = label;
        this.dataChannel = new FakeDataChannel(label);
        return this.dataChannel;
      }
      async createOffer() {
        return {
          type: 'offer',
          sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n',
        };
      }
      async setLocalDescription(offer) {
        this.localDescription = offer;
      }
      async setRemoteDescription() {
        const trackEvent = new Event('track');
        Object.defineProperty(trackEvent, 'streams', { value: [new MediaStream()] });
        this.dispatchEvent(trackEvent);
        for (const event of [
          { type: 'session.started' },
          { type: 'session.input_transcript.delta', delta: 'price first', start_ms: 0, end_ms: 500 },
          { type: 'session.output_transcript.delta', delta: 'Updated.', start_ms: 500, end_ms: 900 },
          { type: 'response.event', event: { type: 'response.completed' } },
        ]) {
          this.dataChannel.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify(event),
          }));
        }
      }
    }
    window.RTCPeerConnection = FakePeerConnection;
  });

  // The cart's three ticked products open straight on the comparison.
  await openLuna(page, testInfo.project.name);
  await expect(page.getByRole('region', { name: 'Luna shopping assistant' })).toHaveAttribute('data-revision', '0');

  const voiceControls = page.locator('section[aria-label="Luna Live voice"]');
  await voiceControls.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(voiceControls.getByRole('status')).toHaveText('connected');
  await expect(page.getByText('You: price first')).toBeVisible();
  await expect(page.getByText('Luna: Updated.')).toBeVisible();
  expect(postedOffer).toContain('m=audio');
  expect(postedOffer).toContain('webrtc-datachannel');
  expect(await page.evaluate(() => window.__lunaDataChannelLabel)).toBe('oai-events');
  expect(await voiceControls.locator('audio').evaluate(audio => Boolean(audio.srcObject))).toBe(true);

  await voiceControls.getByRole('button', { name: 'Mute' }).click();
  await voiceControls.getByRole('button', { name: 'Stop' }).click();
  await expect(voiceControls.getByRole('status')).toHaveText('stopped');
  const sentEventTypes = await page.evaluate(() => window.__lunaLiveSentEvents.map(event => event.type));
  expect(sentEventTypes).toContain('session.input_audio.mute');
  expect(sentEventTypes).toContain('session.close');
  expect(await page.evaluate(() => window.__lunaTrackStopped)).toBe(true);
});

test('widget source imports neither host', async () => {
  const widgetDirectory = path.join(repositoryRoot, 'packages/luna-widget/src');
  const source = fs.readdirSync(widgetDirectory)
    .filter(fileName => /\.(js|jsx)$/.test(fileName))
    .map(fileName => fs.readFileSync(path.join(widgetDirectory, fileName), 'utf8'))
    .join('\n');
  expect(source).not.toContain('shopee-compare-app');
  expect(source).not.toContain('apps/minimal-host');
});

test('Host A has one comparison owner', async () => {
  const hostSourceDirectory = path.join(repositoryRoot, 'shopee-compare-app/src');
  expect(fs.existsSync(path.join(hostSourceDirectory, 'compare'))).toBe(false);
  const source = [
    'App.jsx',
    'components/Section/cart.jsx',
    'components/Section/Compare.jsx',
  ].map(relativePath => fs.readFileSync(path.join(hostSourceDirectory, relativePath), 'utf8'))
    .join('\n');
  expect(source).not.toContain('CompareProvider');
  expect(source).not.toContain('api.openai.com');
  expect(source).not.toContain('Live AI settings');
});
