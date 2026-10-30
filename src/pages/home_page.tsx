import { ArrowUpRight, Bot, Boxes } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../components/actions/button";
import { ErrorPanel } from "../components/feedback/error_panel";
import { Skeleton } from "../components/feedback/skeleton";
import { useRobotStatusStreams } from "../api/pilot/pilot_queries";
import { RobotCard } from "../features/robot_directory/robot_card";
import { createRobotDirectory } from "../features/robot_directory/robot_directory";
import { getPortalConfig } from "../config/portal_config";
import { usePilotDirectory } from "../features/pilot_directory/use_pilot_directory";
import { PilotRobotCard } from "../features/pilot_directory/pilot_robot_card";
import { withPilotScope } from "../features/pilot_directory/pilot_directory";
import styles from "./home_page.module.css";

export function HomePage() {
  const streams = useRobotStatusStreams();
  const pilots = usePilotDirectory();
  const config = getPortalConfig();
  const unselected = config.pilot_discovery_enabled && config.pilot_id === null;
  const other_robots = (pilots.data?.pilots ?? []).flatMap((pilot) =>
    pilot.pilot_id === config.pilot_id
      ? []
      : pilot.control_ids.map((control_id) => ({ pilot, control_id }))
  );
  const discovery_error =
    streams.error instanceof Error ? streams.error.message : null;
  const directory =
    streams.data === undefined ? null : createRobotDirectory(streams.data);
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h1>Home</h1>
          <p>Your robots, their status, and your next move.</p>
        </div>
        <Link
          className={styles.device_link}
          to={withPilotScope("/devices", config.pilot_id ?? null)}
        >
          <Boxes aria-hidden="true" /> Explore devices{" "}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      {unselected ? (
        <p className={styles.notice}>
          Select a robot in the dock to connect to its Pilot.
        </p>
      ) : null}
      {!unselected && streams.isPending ? (
        <Skeleton label="Loading robot directory" />
      ) : null}
      {!unselected && streams.isError ? (
        <ErrorPanel
          action={
            <Button onClick={() => void streams.refetch()}>Try again</Button>
          }
          message={
            discovery_error === null
              ? "Pilot did not provide a usable public RobotStatus stream directory."
              : discovery_error
          }
          title="Robot discovery unavailable"
        />
      ) : null}
      {pilots.isError ? (
        <ErrorPanel
          title="Pilot directory unavailable"
          message="The Portal host could not refresh Pilot discovery."
          action={
            <Button onClick={() => void pilots.refetch()}>Try again</Button>
          }
        />
      ) : null}
      {!unselected &&
      directory?.entries.length === 0 &&
      other_robots.length === 0 ? (
        <ErrorPanel
          message="Connect a Control to Pilot to see its robot here. Camera and Operator devices are available in Devices."
          title="No robots discovered"
        />
      ) : null}
      {(directory?.entries.length ?? 0) + other_robots.length > 0 ? (
        <>
          <div className={styles.section_heading}>
            <h2>
              <Bot aria-hidden="true" /> Robots{" "}
              <span>
                {(directory?.entries.length ?? 0) + other_robots.length}
              </span>
            </h2>
            <p>Select a robot, then open its workspace.</p>
          </div>
          {directory && directory.omitted_count > 0 ? (
            <p className={styles.notice}>
              Showing the first {directory.entries.length} stable Control
              identities. {directory.omitted_count} more are not subscribed on
              this overview.
            </p>
          ) : null}
          <section aria-label="Discovered robots" className={styles.grid}>
            {directory?.entries.map((entry) => (
              <RobotCard entry={entry} key={entry.control_id} />
            ))}
            {other_robots.map(({ pilot, control_id }) => (
              <PilotRobotCard
                key={`${pilot.pilot_id}:${control_id}`}
                pilot={pilot}
                control_id={control_id}
              />
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
