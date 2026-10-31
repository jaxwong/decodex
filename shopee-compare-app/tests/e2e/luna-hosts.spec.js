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
  await expect(page.getByRole('heading', { name: 'Pick 2–4 products to compare' })).toBeVisible();
  const firstVariant = page.getByRole('checkbox', { name: '100W synthetic SKU · SGD 60.00' });
  if (testInfo.project.name === 'host-b-chromium') {
    await expect(firstVariant).toBeVisible();
    await page.getByRole('button', { name: 'Select 100W synthetic SKU · SGD 60.00' }).click();
    await expect(firstVariant).toBeChecked();
  } else {
    await firstVariant.check();
  }
  await page.getByRole('checkbox', { name: '65W synthetic SKU · SGD 69.65' }).check();
  await page.getByRole('checkbox', { name: '87W synthetic SKU · SGD 79.87' }).check();
  await page.getByRole('button', { name: 'Compare 3 products' }).click();

  await expect(widget).toHaveAttribute('data-revision', '0');
  await expect(page.getByRole('table', { name: 'Product comparison' })).toBeVisible();
  await page.getByRole('button', { name: 'View product' }).first().click();
  const productView = page.getByRole('region', { name: 'Host product view' });
  await expect(productView.getByRole('heading', { name: 'SYNTHETIC Atlas power bank family' })).toBeVisible();
  await expect(productView.getByText('100W synthetic SKU', { exact: true })).toBeVisible();
  await expect(productView.getByText('SGD 60.00', { exact: true })).toBeVisible();
  await productView.getByRole('button', { name: 'Close product view' }).click();
  await expect(productView).toHaveCount(0);
  await expect(widget).toHaveAttribute('data-revision', '0');
  await page.getByRole('button', { name: /^Warranty for SYNTHETIC Comet .*: Listing disagrees, 12 vs 24 months$/ }).click();
  await expect(sourcePanel.getByText('Listing disagrees with itself')).toBeVisible();
  await expect(sourcePanel.getByText('Warranty: 1 year')).toBeVisible();
  await expect(sourcePanel.getByText('Warranty: 24 months')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sourcePanel).toHaveCount(0);

  await page.getByLabel('Message Luna').fill(
    'Under S$80, at least 65W, prioritize portability.',
  );
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(widget).toHaveAttribute('data-revision', '1');
  await expect(page.getByText('Preferences applied by the deterministic test model.')).toBeVisible();
  await expect(needs.getByText('Up to SGD 80.00')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Updated to match your needs.' })).toBeVisible();
  await page.getByRole('button', { name: /^Source: / }).first().click();
  await expect(sourcePanel.getByText('Customer review')).toBeVisible();
  await expect(sourcePanel.getByText(/review mention about/)).toBeVisible();
  await sourcePanel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sourcePanel).toHaveCount(0);

  await page.getByLabel('Message Luna').fill('Actually price first.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(widget).toHaveAttribute('data-revision', '2');
  await expect(needs.getByText('Priority 1: Price')).toBeVisible();

  await page.getByLabel('Message Luna').fill('Set my budget to S$70 and keep price first.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(widget).toHaveAttribute('data-revision', '3');
  await expect(needs.getByText('Up to SGD 70.00')).toBeVisible();
  await page.getByRole('button', { name: 'Seller view' }).click();
  const sellerView = page.getByRole('region', { name: 'Demo seller view' });
  await expect(sellerView.getByRole('heading', { name: 'Demo seller view' })).toBeVisible();
  await expect(sellerView.getByText('Counts cover comparisons in this demo session only.')).toBeVisible();
  await expect(sellerView.getByRole('heading', { name: 'Evidence gaps' })).toBeVisible();
  await expect(sellerView.getByText('Weight', { exact: true })).toBeVisible();
  await expect(sellerView.getByText('Warranty', { exact: true })).toBeVisible();
  await expect(sellerView.getByText('Over budget: 1')).toBeVisible();
  await sellerView.getByRole('button', { name: 'Open evidence for Warranty' }).click();
  await expect(sourcePanel.getByRole('heading', { name: /^Warranty · SYNTHETIC Comet/ })).toBeVisible();
  await expect(sourcePanel.getByText('Warranty: 24 months')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sourcePanel).toHaveCount(0);

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Microphone permission was denied. Text chat remains available.')).toBeVisible();
  await expect(page.getByLabel('Message Luna')).toBeEnabled();
  expect(consoleErrors).toEqual([]);
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

  await openLuna(page, testInfo.project.name);
  await expect(page.getByRole('heading', { name: 'Pick 2–4 products to compare' })).toBeVisible();
  await page.getByRole('checkbox', { name: '100W synthetic SKU · SGD 60.00' }).check();
  await page.getByRole('checkbox', { name: '65W synthetic SKU · SGD 69.65' }).check();
  await page.getByRole('checkbox', { name: '87W synthetic SKU · SGD 79.87' }).check();
  await page.getByRole('button', { name: 'Compare 3 products' }).click();
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
