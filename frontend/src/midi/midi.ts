export const midiSupported = () => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

export async function openMidi(onMessage: (on: boolean, note: number, vel: number) => void) {
  if (!midiSupported()) return { outputs: [] as MIDIOutput[], supported: false };
  try {
    const access = await navigator.requestMIDIAccess();
    access.inputs.forEach((input) => {
      input.onmidimessage = (e) => {
        const d = e.data;
        if (!d || d.length < 3) return;
        const cmd = d[0] & 0xf0;
        if (cmd === 0x90 && d[2] > 0) onMessage(true, d[1], d[2] / 127);
        else if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) onMessage(false, d[1], 0);
      };
    });
    return { outputs: [...access.outputs.values()], supported: true };
  } catch {
    return { outputs: [] as MIDIOutput[], supported: false };
  }
}
