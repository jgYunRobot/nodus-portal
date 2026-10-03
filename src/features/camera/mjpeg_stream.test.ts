import { describe, expect, it } from "vitest";
import { MjpegStreamParser } from "./mjpeg_stream";

const encoder = new TextEncoder();

describe("MjpegStreamParser", () => {
  it("extracts length-delimited JPEG parts split across transport chunks", () => {
    const parser = new MjpegStreamParser();
    const first = encoder.encode(
      "--nodus_frame\r\nContent-Type: image/jpeg\r\nContent-Length: 4\r\n\r\n"
    );
    const payload = new Uint8Array([...first, 1, 2, 3, 4, 13, 10]);

    expect(parser.push(payload.slice(0, payload.length - 3))).toEqual([]);
    expect(parser.push(payload.slice(payload.length - 3))).toEqual([
      new Uint8Array([1, 2, 3, 4])
    ]);
  });

  it("rejects a part without a bounded Content-Length", () => {
    const parser = new MjpegStreamParser();
    expect(() =>
      parser.push(
        encoder.encode("--nodus_frame\r\nContent-Type: image/jpeg\r\n\r\n")
      )
    ).toThrow("Content-Length");
  });
});
