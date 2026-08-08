import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent
} from "react";
import { useSearchParams } from "react-router";
import { Button } from "../components/actions/button";
import { Card } from "../components/feedback/card";
import { StatusBadge } from "../components/feedback/status_badge";
import { selectVisionCameraEndpoints } from "../features/camera/vision_camera";
import { useVisionCamera } from "../features/camera/use_vision_camera";
import { resolveDeviceDeckSelection } from "../features/device_directory/device_deck";
import type {
  DeviceDeckSlot,
  DeviceDirectoryEntry
} from "../features/device_directory/device_directory";
import { useDeviceDirectory } from "../features/device_directory/use_device_directory";
import styles from "./device_page.module.css";

const SWIPE_THRESHOLD_PX = 48;

interface PointerStart {
  pointer_id: number;
  x: number;
}

export function DevicePage() {
  const { directory, error, is_loading } = useDeviceDirectory();
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h1>Device directory</h1>
          <p>Discover connected provider devices independently of any robot.</p>
        </div>
      </div>
      {is_loading && <Card>Loading the public device directory…</Card>}
      {error !== null && error !== undefined && (
        <Card>
          <h2>Device directory unavailable</h2>
          <p>{getErrorMessage(error)}</p>
        </Card>
      )}
      {directory !== undefined && <DeviceDeck slots={directory.slots} />}
    </main>
  );
}

function DeviceDeck({ slots }: { slots: DeviceDeckSlot[] }) {
  const [search_params, setSearchParams] = useSearchParams();
  const [selected_empty_index, setSelectedEmptyIndex] = useState<number | null>(
    null
  );
  const pointer_start = useRef<PointerStart | null>(null);
  const requested_component_id = search_params.get("device");
  const selection = resolveDeviceDeckSelection(
    slots,
    requested_component_id,
    selected_empty_index
  );
  const active_index = selection.active_index;

  function selectIndex(index: number): void {
    const slot = slots[index];
    if (slot === undefined) return;
    if (slot.kind === "connected") {
      setSearchParams({ device: slot.entry.component_id });
      return;
    }
    setSelectedEmptyIndex(index);
    setSearchParams({});
  }

  function selectRelative(offset: number): void {
    const base_index = active_index ?? 0;
    const destination_index = base_index + offset;
    if (destination_index < 0 || destination_index >= slots.length) return;
    selectIndex(destination_index);
  }

  function handleDeckKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectRelative(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectRelative(1);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    if (isInteractiveTarget(event.target)) return;
    pointer_start.current = { pointer_id: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>): void {
    const start = pointer_start.current;
    pointer_start.current = null;
    if (start === null || start.pointer_id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const distance = event.clientX - start.x;
    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    selectRelative(distance > 0 ? -1 : 1);
  }

  return (
    <section
      aria-label="Device carousel"
      aria-roledescription="carousel"
      className={styles.deck}
      onKeyDown={handleDeckKeyDown}
      tabIndex={0}
    >
      <div className={styles.deck_controls}>
        <p aria-live="polite" className={styles.deck_position}>
          {active_index === null
            ? "Unavailable device"
            : `${active_index + 1} / ${slots.length}`}
        </p>
        <label className={styles.picker_label}>
          Device picker
          <select
            aria-label="Device picker"
            onChange={(event) => selectIndex(Number(event.target.value))}
            value={active_index ?? "unavailable"}
          >
            {selection.unavailable_component_id !== null && (
              <option value="unavailable">
                {selection.unavailable_component_id} (unavailable)
              </option>
            )}
            {slots.map((slot, index) => (
              <option key={getSlotKey(slot)} value={index}>
                {getSlotLabel(slot)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className={styles.deck_frame}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {active_index === null ? (
          <UnavailableCard component_id={selection.unavailable_component_id} />
        ) : (
          slots.map((slot, index) => {
            const offset = index - active_index;
            return (
              <div
                aria-hidden={offset !== 0}
                className={styles.deck_card}
                data-active={offset === 0}
                data-offset={offset}
                inert={offset !== 0}
                key={getSlotKey(slot)}
                style={
                  {
                    "--deck-offset": offset,
                    zIndex: 10 - Math.abs(offset)
                  } as CSSProperties
                }
              >
                {offset === 0 ? (
                  slot.kind === "connected" ? (
                    <DeviceCard
                      entry={slot.entry}
                      position={index + 1}
                      total={slots.length}
                    />
                  ) : (
                    <EmptySlotCard slot_number={slot.slot_number} />
                  )
                ) : (
                  <InactiveCard slot={slot} />
                )}
              </div>
            );
          })
        )}
        {active_index !== null && active_index > 0 && (
          <button
            aria-label={`Select ${getSlotLabel(slots[active_index - 1])}`}
            className={`${styles.deck_edge} ${styles.previous_edge}`}
            onClick={() => selectRelative(-1)}
            type="button"
          />
        )}
        {active_index !== null && active_index < slots.length - 1 && (
          <button
            aria-label={`Select ${getSlotLabel(slots[active_index + 1])}`}
            className={`${styles.deck_edge} ${styles.next_edge}`}
            onClick={() => selectRelative(1)}
            type="button"
          />
        )}
      </div>
      <div className={styles.deck_actions}>
        <Button
          aria-label="Previous device"
          disabled={active_index === null || active_index === 0}
          onClick={() => selectRelative(-1)}
          tone="secondary"
        >
          Previous
        </Button>
        <Button
          aria-label="Next device"
          disabled={active_index === null || active_index === slots.length - 1}
          onClick={() => selectRelative(1)}
          tone="secondary"
        >
          Next
        </Button>
      </div>
    </section>
  );
}

function DeviceCard({
  entry,
  position,
  total
}: {
  entry: DeviceDirectoryEntry;
  position: number;
  total: number;
}) {
  if (entry.card_kind === "camera")
    return <CameraDeviceCard entry={entry} position={position} total={total} />;
  return (
    <Card className={styles.device_card}>
      <div aria-live="polite" className={styles.card_heading}>
        <div>
          <p className={styles.type_label}>{getCardTypeLabel(entry)}</p>
          <h2>{entry.display_name}</h2>
          <p className={styles.component_id}>{entry.component_id}</p>
          <p className={styles.position_label}>
            Device {position} of {total}
          </p>
        </div>
        <StatusBadge
          label={getLifecycleLabel(entry.lifecycle_state)}
          tone={getLifecycleTone(entry.lifecycle_state)}
        />
      </div>
      <dl className={styles.details}>
        <div>
          <dt>Instance</dt>
          <dd>{entry.instance_id}</dd>
        </div>
        <div>
          <dt>Capabilities</dt>
          <dd>{entry.capabilities.join(", ") || "None advertised"}</dd>
        </div>
        <div>
          <dt>Endpoints</dt>
          <dd>{entry.endpoint_count}</dd>
        </div>
      </dl>
      {entry.malformed_endpoint_count > 0 && (
        <p className={styles.warning}>
          {entry.malformed_endpoint_count} malformed endpoint descriptor
          {entry.malformed_endpoint_count === 1 ? "" : "s"} ignored.
        </p>
      )}
      <p className={styles.read_only}>Read-only information</p>
    </Card>
  );
}

function CameraDeviceCard({
  entry,
  position,
  total
}: {
  entry: DeviceDirectoryEntry;
  position: number;
  total: number;
}) {
  const endpoints = useMemo(() => selectVisionCameraEndpoints(entry), [entry]);
  const { error, is_loading, runtime } = useVisionCamera(
    entry.runtime_key,
    endpoints
  );
  const is_narrow_viewport = useNarrowViewport();
  const [selected_preview, setSelectedPreview] = useState<"color" | "depth">(
    "color"
  );
  return (
    <Card className={styles.device_card}>
      <DeviceCardHeader entry={entry} position={position} total={total} />
      {endpoints === null ? (
        <p className={styles.warning}>
          No exact Vision 1.3.0 Color preview contract is advertised.
        </p>
      ) : error !== null ? (
        <p className={styles.warning}>
          Direct Camera connection failed: {error}
        </p>
      ) : is_loading ? (
        <p className={styles.read_only}>Loading direct Camera information…</p>
      ) : runtime !== null ? (
        <>
          <div className={styles.camera_media}>
            {is_narrow_viewport && endpoints.depth !== null && (
              <div className={styles.preview_segments}>
                <Button
                  aria-pressed={selected_preview === "color"}
                  onClick={() => setSelectedPreview("color")}
                  tone="secondary"
                >
                  Color
                </Button>
                <Button
                  aria-pressed={selected_preview === "depth"}
                  onClick={() => setSelectedPreview("depth")}
                  tone="secondary"
                >
                  Depth
                </Button>
              </div>
            )}
            {(!is_narrow_viewport || selected_preview === "color") && (
              <figure>
                <img
                  alt={`${entry.display_name} color preview`}
                  src={endpoints.color.endpoint}
                />
                <figcaption>Color</figcaption>
              </figure>
            )}
            {endpoints.depth !== null &&
              (!is_narrow_viewport || selected_preview === "depth") && (
                <figure>
                  <img
                    alt={`${entry.display_name} depth preview`}
                    src={endpoints.depth.endpoint}
                  />
                  <figcaption>Depth</figcaption>
                </figure>
              )}
          </div>
          <dl className={styles.details}>
            <div>
              <dt>Device</dt>
              <dd>{runtime.metadata.device_id}</dd>
            </div>
            <div>
              <dt>Adapter</dt>
              <dd>{runtime.metadata.adapter}</dd>
            </div>
            <div>
              <dt>Calibration</dt>
              <dd>{runtime.metadata.calibration_id}</dd>
            </div>
            <div>
              <dt>Frames</dt>
              <dd>
                {runtime.metadata.sensor_frame} → {runtime.metadata.mount_frame}
              </dd>
            </div>
            <div>
              <dt>Capture health</dt>
              <dd>{runtime.health.camera_state}</dd>
            </div>
          </dl>
        </>
      ) : null}
      <p className={styles.read_only}>Read-only information</p>
    </Card>
  );
}

function DeviceCardHeader({
  entry,
  position,
  total
}: {
  entry: DeviceDirectoryEntry;
  position: number;
  total: number;
}) {
  return (
    <div aria-live="polite" className={styles.card_heading}>
      <div>
        <p className={styles.type_label}>{getCardTypeLabel(entry)}</p>
        <h2>{entry.display_name}</h2>
        <p className={styles.component_id}>{entry.component_id}</p>
        <p className={styles.position_label}>
          Device {position} of {total}
        </p>
      </div>
      <StatusBadge
        label={getLifecycleLabel(entry.lifecycle_state)}
        tone={getLifecycleTone(entry.lifecycle_state)}
      />
    </div>
  );
}

function EmptySlotCard({ slot_number }: { slot_number: number }) {
  return (
    <Card className={styles.empty_slot}>
      <h2>Empty slot {slot_number}</h2>
      <p>No supported provider device is registered in this slot.</p>
    </Card>
  );
}

function UnavailableCard({ component_id }: { component_id: string | null }) {
  return (
    <Card className={styles.unavailable_card}>
      <h2>Device unavailable</h2>
      <p>
        {component_id} is no longer in the live Pilot device directory. Select a
        listed device to return to the directory.
      </p>
    </Card>
  );
}

function InactiveCard({ slot }: { slot: DeviceDeckSlot }) {
  return (
    <Card className={styles.inactive_card}>
      <p>
        {slot.kind === "connected"
          ? getCardTypeLabel(slot.entry)
          : "Empty slot"}
      </p>
      <h2>{getSlotLabel(slot)}</h2>
    </Card>
  );
}

function getSlotKey(slot: DeviceDeckSlot): string {
  return slot.kind === "connected"
    ? slot.entry.component_id
    : `empty-${slot.slot_number}`;
}

function getSlotLabel(slot: DeviceDeckSlot): string {
  return slot.kind === "connected"
    ? slot.entry.display_name
    : `Empty slot ${slot.slot_number}`;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("button, a, input, select, textarea, [data-no-swipe]") !==
      null
  );
}

function getCardTypeLabel(entry: DeviceDirectoryEntry): string {
  if (entry.card_kind === "camera") return "Camera";
  if (entry.card_kind === "operator") return "Operator";
  return entry.component_type;
}

function getLifecycleLabel(
  state: DeviceDirectoryEntry["lifecycle_state"]
): string {
  if (state === "ready") return "Online";
  if (state === "degraded") return "Degraded";
  if (state === "faulted") return "Faulted";
  if (state === "stopping") return "Stopping";
  return "Starting";
}

function getLifecycleTone(
  state: DeviceDirectoryEntry["lifecycle_state"]
): "success" | "warning" | "danger" | "neutral" {
  if (state === "ready") return "success";
  if (state === "degraded" || state === "stopping") return "warning";
  if (state === "faulted") return "danger";
  return "neutral";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Pilot did not provide a usable device directory.";
}

function useNarrowViewport(): boolean {
  const [is_narrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const media_query = window.matchMedia("(max-width: 720px)");
    const updateNarrow = () => setIsNarrow(media_query.matches);
    updateNarrow();
    media_query.addEventListener("change", updateNarrow);
    return () => media_query.removeEventListener("change", updateNarrow);
  }, []);
  return is_narrow;
}
