import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { lunaClient } from './lunaClient.js';

const iceGatheringTimeoutMs = 10_000;
const gracefulCloseTimeoutMs = 15_000;

function releaseLiveResources(resources) {
  if (!resources) return;
  clearTimeout(resources.closeTimeoutId);
  resources.abortController?.abort();
  resources.stream?.getTracks().forEach(track => track.stop());
  resources.dataChannel?.close();
  resources.peerConnection?.close();
  if (resources.audioElement) resources.audioElement.srcObject = null;
}

async function waitForIceGathering(peerConnection) {
  if (peerConnection.iceGatheringState === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      peerConnection.removeEventListener('icegatheringstatechange', handleChange);
      reject(new Error('Timed out while gathering WebRTC network candidates'));
    }, iceGatheringTimeoutMs);
    function handleChange() {
      if (peerConnection.iceGatheringState !== 'complete') return;
      clearTimeout(timeoutId);
      peerConnection.removeEventListener('icegatheringstatechange', handleChange);
      resolve();
    }
    peerConnection.addEventListener('icegatheringstatechange', handleChange);
  });
}

function liveErrorText(failure) {
  if (failure?.name === 'NotAllowedError') {
    return 'Microphone permission was denied. Text chat remains available.';
  }
  return failure?.message || 'The Live voice connection failed. Text chat remains available.';
}

export function LiveVoiceControls({
  apiBaseUrl,
  token,
  comparisonId,
  disabled,
  onCanonicalStateChanged,
}) {
  const [status, setStatus] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');
  const [captions, setCaptions] = useState({ user: '', assistant: '' });
  const audioRef = useRef(null);
  const isMountedRef = useRef(true);
  const resourcesRef = useRef(null);
  const refreshPendingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const resources = resourcesRef.current;
      if (resources?.dataChannel?.readyState === 'open') {
        resources.dataChannel.send(JSON.stringify({ type: 'session.close' }));
      }
      releaseLiveResources(resources);
      resourcesRef.current = null;
    };
  }, []);

  async function refreshCanonicalState() {
    if (refreshPendingRef.current) return;
    refreshPendingRef.current = true;
    try {
      await onCanonicalStateChanged();
    } finally {
      refreshPendingRef.current = false;
    }
  }

  function finish(nextStatus, nextError = '') {
    releaseLiveResources(resourcesRef.current);
    resourcesRef.current = null;
    if (!isMountedRef.current) return;
    setStatus(nextStatus);
    setIsMuted(false);
    setError(nextError);
  }

  function handleLiveEvent(messageEvent) {
    let event;
    try {
      event = JSON.parse(messageEvent.data);
    } catch (failure) {
      finish('failed', `Live returned invalid event JSON: ${failure.message}`);
      return;
    }

    if (event.type === 'session.started') {
      setStatus('connected');
      return;
    }
    if (event.type === 'session.input_transcript.delta') {
      setCaptions(previous => ({ ...previous, user: previous.user + event.delta }));
      return;
    }
    if (event.type === 'session.output_transcript.delta') {
      setCaptions(previous => ({ ...previous, assistant: previous.assistant + event.delta }));
      return;
    }
    if (event.type === 'session.updated') {
      void refreshCanonicalState();
      return;
    }
    if (event.type === 'response.event' && event.event?.type === 'response.completed') {
      void refreshCanonicalState();
      return;
    }
    if (event.type === 'session.closed') {
      finish('stopped');
      return;
    }
    if (event.type === 'error') {
      finish('failed', event.error?.message || 'OpenAI Live reported a session error.');
    }
  }

  async function start() {
    if (disabled || status === 'connecting' || status === 'connected' || status === 'stopping') return;
    setStatus('connecting');
    setError('');
    setCaptions({ user: '', assistant: '' });
    const resources = {
      abortController: new AbortController(),
      audioElement: audioRef.current,
      closeTimeoutId: null,
      dataChannel: null,
      peerConnection: null,
      stream: null,
    };
    resourcesRef.current = resources;

    try {
      resources.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      resources.peerConnection = new RTCPeerConnection();
      resources.peerConnection.addEventListener('track', trackEvent => {
        if (resources.audioElement) resources.audioElement.srcObject = trackEvent.streams[0];
      });
      resources.peerConnection.addEventListener('connectionstatechange', () => {
        if (resources.peerConnection.connectionState === 'failed') {
          finish('failed', 'The Live peer connection closed before session finalization.');
        }
      });
      for (const track of resources.stream.getAudioTracks()) {
        resources.peerConnection.addTrack(track, resources.stream);
      }
      resources.dataChannel = resources.peerConnection.createDataChannel('oai-events');
      resources.dataChannel.addEventListener('message', handleLiveEvent);

      const offer = await resources.peerConnection.createOffer();
      await resources.peerConnection.setLocalDescription(offer);
      await waitForIceGathering(resources.peerConnection);
      const localSdp = resources.peerConnection.localDescription?.sdp;
      if (!localSdp) throw new Error('Browser did not produce a WebRTC offer');

      const liveSession = await lunaClient.createLiveSession(
        apiBaseUrl,
        token,
        comparisonId,
        localSdp,
        resources.abortController.signal,
      );
      if (liveSession?.transport?.type !== 'webrtc' || !liveSession.transport.sdp) {
        throw new Error('Luna API returned an invalid WebRTC answer');
      }
      await resources.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: liveSession.transport.sdp,
      });
    } catch (failure) {
      finish('failed', liveErrorText(failure));
    }
  }

  function toggleMute() {
    const dataChannel = resourcesRef.current?.dataChannel;
    if (!dataChannel || dataChannel.readyState !== 'open' || status !== 'connected') return;
    const nextMuted = !isMuted;
    dataChannel.send(JSON.stringify({
      type: nextMuted ? 'session.input_audio.mute' : 'session.input_audio.unmute',
    }));
    setIsMuted(nextMuted);
  }

  function stop() {
    const resources = resourcesRef.current;
    if (!resources || status === 'stopping') return;
    if (resources.dataChannel?.readyState !== 'open') {
      finish('failed', 'Live data channel closed before the session could be finalized.');
      return;
    }
    setStatus('stopping');
    resources.closeTimeoutId = setTimeout(() => {
      finish('failed', 'Live stop was incomplete because session.closed did not arrive.');
    }, gracefulCloseTimeoutMs);
    resources.dataChannel.send(JSON.stringify({ type: 'session.input_audio.mute' }));
    resources.dataChannel.send(JSON.stringify({ type: 'session.close' }));
  }

  const isActive = ['connecting', 'connected', 'stopping'].includes(status);
  return <section aria-label="Luna Live voice" className="border border-orange-100 rounded-xl p-3">
    <div className="flex flex-wrap items-center gap-2">
      <strong className="text-sm">Voice</strong>
      <span role="status" className="text-xs text-gray-500">{status}</span>
      {!isActive && <button type="button" onClick={start} disabled={disabled}
        className="text-xs bg-orange-600 text-white rounded px-3 py-2 disabled:opacity-50">Start</button>}
      {isActive && <button type="button" onClick={toggleMute} disabled={status !== 'connected'}
        className="text-xs border rounded px-3 py-2 disabled:opacity-50">{isMuted ? 'Unmute' : 'Mute'}</button>}
      {isActive && <button type="button" onClick={stop} disabled={status === 'stopping'}
        className="text-xs border border-red-200 text-red-700 rounded px-3 py-2 disabled:opacity-50">Stop</button>}
    </div>
    {error && <p role="alert" className="text-xs text-red-700 mt-2">{error}</p>}
    {(captions.user || captions.assistant) && <div aria-label="Provisional voice captions" className="bg-gray-50 rounded p-2 mt-2 text-xs">
      <p className="text-gray-500 mb-1">Provisional captions</p>
      {captions.user && <p><strong>You:</strong> {captions.user}</p>}
      {captions.assistant && <p><strong>Luna:</strong> {captions.assistant}</p>}
    </div>}
    <audio ref={audioRef} autoPlay />
  </section>;
}

LiveVoiceControls.propTypes = {
  apiBaseUrl: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
  comparisonId: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  onCanonicalStateChanged: PropTypes.func.isRequired,
};
