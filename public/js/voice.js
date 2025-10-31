import { emit, on } from './socket.js';
import { toast } from './ui.js';

const voiceButton = document.getElementById('btn-voice');
const muteButton = document.getElementById('btn-mute');
const peersContainer = document.getElementById('voice-peers');

let localStream;
const peerConnections = new Map();
let isMuted = false;

function renderLocalPeer() {
  if (!localStream) return;
  let node = peersContainer.querySelector('[data-peer="self"]');
  if (!node) {
    node = document.createElement('div');
    node.className = 'voice-peer';
    node.dataset.peer = 'self';
    const indicator = document.createElement('span');
    indicator.className = 'voice-indicator active';
    const label = document.createElement('span');
    label.textContent = 'Você';
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.muted = true;
    node.append(indicator, label, audio);
    peersContainer.prepend(node);
  }
  const audio = node.querySelector('audio');
  audio.srcObject = localStream;
}

async function initLocalStream() {
  if (localStream) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    updateMuteState();
    return localStream;
  } catch (error) {
    toast('Permita o acesso ao microfone.');
    throw error;
  }
}

function createPeerConnection(id) {
  const connection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  connection.onicecandidate = (event) => {
    if (event.candidate) {
      emit('voice:signal', { target: id, data: { candidate: event.candidate } });
    }
  };
  connection.ontrack = (event) => {
    attachRemoteStream(id, event.streams[0]);
  };
  if (localStream) {
    localStream.getTracks().forEach((track) => connection.addTrack(track, localStream));
  }
  peerConnections.set(id, connection);
  return connection;
}

function attachRemoteStream(id, stream) {
  let node = peersContainer.querySelector(`[data-peer="${id}"]`);
  if (!node) {
    node = document.createElement('div');
    node.className = 'voice-peer';
    node.dataset.peer = id;
    const indicator = document.createElement('span');
    indicator.className = 'voice-indicator';
    const label = document.createElement('span');
    label.textContent = id.slice(0, 6);
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.controls = false;
    audio.dataset.peerAudio = id;
    node.append(indicator, label, audio);
    peersContainer.append(node);
  }
  const audio = node.querySelector('audio');
  audio.srcObject = stream;
  monitorSpeaking(stream, node.querySelector('.voice-indicator'));
}

function monitorSpeaking(stream, indicator) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const [track] = stream.getAudioTracks();
  track?.addEventListener('ended', () => audioCtx.close());
  function tick() {
    analyser.getByteFrequencyData(data);
    const volume = data.reduce((a, b) => a + b, 0) / data.length;
    indicator.classList.toggle('active', volume > 50);
    requestAnimationFrame(tick);
  }
  tick();
}

async function joinVoice() {
  try {
    await initLocalStream();
  } catch (error) {
    return;
  }
  renderLocalPeer();
  emit('voice:join', {}, async (response) => {
    if (!response?.ok) {
      toast(response?.message || 'Erro ao conectar voz');
      return;
    }
    voiceButton.disabled = true;
    toast('Conectado ao áudio.');
    response.peers.forEach(async (peerId) => {
      await callPeer(peerId);
    });
  });
}

async function callPeer(peerId) {
  const connection = createPeerConnection(peerId);
  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  emit('voice:signal', { target: peerId, data: { description: connection.localDescription } });
}

function updateMuteState() {
  if (!localStream) return;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !isMuted;
  });
  muteButton.textContent = isMuted ? 'Desmutar (M)' : 'Mute (M)';
}

muteButton?.addEventListener('click', () => {
  isMuted = !isMuted;
  updateMuteState();
});

voiceButton?.addEventListener('click', joinVoice);

on('voice:peer-joined', ({ socketId }) => {
  toast('Novo participante de voz.');
  createPeerConnection(socketId);
});

on('voice:peer-left', ({ socketId }) => {
  const connection = peerConnections.get(socketId);
  connection?.close();
  peerConnections.delete(socketId);
  const node = peersContainer.querySelector(`[data-peer="${socketId}"]`);
  node?.remove();
});

on('voice:signal', async ({ from, data }) => {
  let connection = peerConnections.get(from);
  if (!connection) {
    connection = createPeerConnection(from);
  }
  if (data.description) {
    const description = new RTCSessionDescription(data.description);
    await connection.setRemoteDescription(description);
    if (description.type === 'offer') {
      await initLocalStream();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      emit('voice:signal', { target: from, data: { description: connection.localDescription } });
    }
  } else if (data.candidate) {
    try {
      await connection.addIceCandidate(data.candidate);
    } catch (error) {
      console.error('ICE candidate error', error);
    }
  }
});

export function initVoiceShortcuts() {
  // placeholder for potential future hooks
}

export function leaveVoice() {
  emit('voice:leave');
  peerConnections.forEach((connection) => connection.close());
  peerConnections.clear();
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = undefined;
  }
  peersContainer.innerHTML = '';
  voiceButton.disabled = false;
}

window.addEventListener('beforeunload', leaveVoice);
