import { useEffect, useRef, useState } from "react";
import { MjpegStreamParser } from "./mjpeg_stream";
import styles from "./mjpeg_preview.module.css";

const RETRY_INITIAL_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 5000;
const STREAM_STALL_TIMEOUT_MS = 5000;

export function MjpegPreview({
  alt,
  endpoint,
  on_stream_failure
}: {
  alt: string;
  endpoint: string;
  on_stream_failure: () => Promise<void>;
}) {
  const image_ref = useRef<HTMLImageElement | null>(null);
  const failure_callback = useRef(on_stream_failure);
  const [is_recovering, setIsRecovering] = useState(true);

  useEffect(() => {
    failure_callback.current = on_stream_failure;
  }, [on_stream_failure]);

  useEffect(() => {
    let is_active = true;
    let connection_controller: AbortController | null = null;
    let retry_timeout: number | null = null;
    let retry_resolve: (() => void) | null = null;
    let retry_delay_ms = RETRY_INITIAL_DELAY_MS;
    let displayed_url: string | null = null;
    let pending_url: string | null = null;

    function releaseImages(): void {
      const image = image_ref.current;
      if (image !== null) {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute("src");
      }
      if (pending_url !== null) URL.revokeObjectURL(pending_url);
      if (displayed_url !== null) URL.revokeObjectURL(displayed_url);
      pending_url = null;
      displayed_url = null;
    }

    function presentFrame(frame: Uint8Array): void {
      const image = image_ref.current;
      if (!is_active || image === null || pending_url !== null) return;
      const frame_buffer = frame.slice().buffer as ArrayBuffer;
      const next_url = URL.createObjectURL(
        new Blob([frame_buffer], { type: "image/jpeg" })
      );
      pending_url = next_url;
      image.onload = () => {
        if (!is_active || pending_url !== next_url) return;
        if (displayed_url !== null) URL.revokeObjectURL(displayed_url);
        displayed_url = next_url;
        pending_url = null;
        retry_delay_ms = RETRY_INITIAL_DELAY_MS;
        setIsRecovering(false);
      };
      image.onerror = () => {
        if (pending_url === next_url) {
          URL.revokeObjectURL(next_url);
          pending_url = null;
        }
        connection_controller?.abort();
      };
      image.src = next_url;
    }

    async function readChunk(
      reader: ReadableStreamDefaultReader<Uint8Array>,
      controller: AbortController
    ): Promise<ReadableStreamReadResult<Uint8Array>> {
      let stall_timeout: number | null = null;
      try {
        stall_timeout = window.setTimeout(
          () => controller.abort(),
          STREAM_STALL_TIMEOUT_MS
        );
        return await reader.read();
      } finally {
        if (stall_timeout !== null) window.clearTimeout(stall_timeout);
      }
    }

    async function consumeStream(controller: AbortController): Promise<void> {
      const response = await fetch(endpoint, {
        headers: { Accept: "multipart/x-mixed-replace" },
        signal: controller.signal
      });
      if (!response.ok)
        throw new Error(`MJPEG stream failed with HTTP ${response.status}.`);
      if (
        response.body === null ||
        !response.headers
          .get("content-type")
          ?.toLowerCase()
          .includes("multipart/x-mixed-replace")
      ) {
        throw new Error("MJPEG stream response is not multipart data.");
      }

      const reader = response.body.getReader();
      const parser = new MjpegStreamParser();
      try {
        while (is_active) {
          const result = await readChunk(reader, controller);
          if (result.done)
            throw new Error("MJPEG stream ended before the preview closed.");
          for (const frame of parser.push(result.value)) presentFrame(frame);
        }
      } finally {
        reader.releaseLock();
      }
    }

    async function waitForRetry(delay_ms: number): Promise<void> {
      await new Promise<void>((resolve) => {
        retry_resolve = resolve;
        retry_timeout = window.setTimeout(() => {
          retry_timeout = null;
          retry_resolve = null;
          resolve();
        }, delay_ms);
      });
    }

    async function runStream(): Promise<void> {
      while (is_active) {
        connection_controller = new AbortController();
        try {
          await consumeStream(connection_controller);
        } catch {
          if (!is_active) return;
          setIsRecovering(true);
          void failure_callback.current();
        } finally {
          connection_controller = null;
        }
        const delay_ms = retry_delay_ms;
        retry_delay_ms = Math.min(delay_ms * 2, RETRY_MAX_DELAY_MS);
        await waitForRetry(delay_ms);
      }
    }

    void runStream();
    return () => {
      is_active = false;
      connection_controller?.abort();
      if (retry_timeout !== null) window.clearTimeout(retry_timeout);
      retry_resolve?.();
      retry_resolve = null;
      releaseImages();
    };
  }, [endpoint]);

  return (
    <div className={styles.preview}>
      <img alt={alt} ref={image_ref} />
      {is_recovering && (
        <p aria-live="polite" className={styles.status} role="status">
          Camera preview is reconnecting…
        </p>
      )}
    </div>
  );
}
