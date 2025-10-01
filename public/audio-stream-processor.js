// AudioWorkletProcessor for handling audio streaming without main thread interference
class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isActive = true;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.isActive = false;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!this.isActive || !input || !input.length) {
      return this.isActive;
    }

    // Copy input to output (pass-through with processing on audio thread)
    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      
      if (inputChannel) {
        outputChannel.set(inputChannel);
      }
    }

    return this.isActive;
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
