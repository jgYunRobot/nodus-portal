const HEADER_SEPARATOR = new Uint8Array([13, 10, 13, 10]);
const MAX_HEADER_BYTES = 16384;
const MAX_FRAME_BYTES = 32 * 1024 * 1024;

export class MjpegStreamParser {
  private buffer = new Uint8Array(0);

  push(chunk: Uint8Array): Uint8Array[] {
    const combined = new Uint8Array(this.buffer.length + chunk.length);
    combined.set(this.buffer);
    combined.set(chunk, this.buffer.length);
    this.buffer = combined;
    const frames: Uint8Array[] = [];

    while (this.buffer.length > 0) {
      const header_end = findSequence(this.buffer, HEADER_SEPARATOR);
      if (header_end < 0) {
        if (this.buffer.length > MAX_HEADER_BYTES)
          throw new Error("MJPEG part header exceeds the preview limit.");
        break;
      }
      if (header_end > MAX_HEADER_BYTES)
        throw new Error("MJPEG part header exceeds the preview limit.");
      const header = new TextDecoder().decode(
        this.buffer.subarray(0, header_end)
      );
      const length_match = /(?:^|\r\n)Content-Length:\s*(\d+)(?:\r\n|$)/i.exec(
        header
      );
      if (length_match === null)
        throw new Error("MJPEG part does not declare Content-Length.");
      const frame_length = Number(length_match[1]);
      if (!Number.isSafeInteger(frame_length) || frame_length <= 0)
        throw new Error("MJPEG part has an invalid Content-Length.");
      if (frame_length > MAX_FRAME_BYTES)
        throw new Error("MJPEG frame exceeds the preview limit.");

      const frame_start = header_end + HEADER_SEPARATOR.length;
      const frame_end = frame_start + frame_length;
      if (this.buffer.length < frame_end) break;
      frames.push(this.buffer.slice(frame_start, frame_end));
      let next_start = frame_end;
      if (
        this.buffer.length >= frame_end + 2 &&
        this.buffer[frame_end] === 13 &&
        this.buffer[frame_end + 1] === 10
      ) {
        next_start += 2;
      }
      this.buffer = this.buffer.slice(next_start);
    }
    return frames;
  }
}

function findSequence(buffer: Uint8Array, target: Uint8Array): number {
  const last_start = buffer.length - target.length;
  for (let start = 0; start <= last_start; start += 1) {
    let matches = true;
    for (let offset = 0; offset < target.length; offset += 1) {
      if (buffer[start + offset] !== target[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return start;
  }
  return -1;
}
