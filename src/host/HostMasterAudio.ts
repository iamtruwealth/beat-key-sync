import * as Tone from 'tone';

export class HostMasterAudio {
  audioCtx: AudioContext;
  masterGain: GainNode;
  destination: MediaStreamAudioDestinationNode;
  masterStream: MediaStream;
  startTime: number = 0;

  constructor() {
    this.audioCtx = Tone.getContext().rawContext as AudioContext;

    // Master gain node
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 1;

    // MediaStream destination for broadcasting
    this.destination = this.audioCtx.createMediaStreamDestination();
    this.masterGain.connect(this.destination);

    // The stream to send to participants
    this.masterStream = this.destination.stream;
  }

  // Play a Tone.js player or synth through master gain
  connectNode(node: Tone.ToneAudioNode) {
    node.connect(this.masterGain);
  }

  // Start looping audio
  startLoop(player: Tone.Player, loopStart: number = 0, loopEnd: number = 8) {
    player.loop = true;
    player.loopStart = loopStart;
    player.loopEnd = loopEnd;
    player.sync().start(0);
    this.startTime = this.audioCtx.currentTime;
  }

  // Get current playback time for late joiners
  getCurrentTime() {
    return this.audioCtx.currentTime - this.startTime;
  }
}
