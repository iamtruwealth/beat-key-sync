class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    // Copy to a transferable buffer for efficiency
    const buffer = new Float32Array(channel.length);
    buffer.set(channel);
    this.port.postMessage(buffer, [buffer.buffer]);
    return true; // keep processor alive
  }
}

// @ts-ignore
registerProcessor('pcm-audio-processor', PCMProcessor);
