import { ArrowUpRight, Bot, Boxes } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../components/actions/button";
import { ErrorPanel } from "../components/feedback/error_panel";
import { Skeleton } from "../components/feedback/skeleton";
import { useRobotStatusStreams } from "../api/pilot/pilot_queries";
import { RobotCard } from "../features/robot_directory/robot_card";
import { createRobotDirectory } from "../features/robot_directory/robot_directory";
import styles from "./home_page.module.css";

export function HomePage() {
  const streams = useRobotStatusStreams();
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
        <Link className={styles.device_link} to="/devices">
          <Boxes aria-hidden="true" /> Explore devices{" "}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      {streams.isPending ? <Skeleton label="Loading robot directory" /> : null}
      {streams.isError ? (
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
      {directory?.entries.length === 0 ? (
        <ErrorPanel
          message="Connect a Control to Pilot to see its robot here. Camera and Operator devices are available in Devices."
          title="No robots discovered"
        />
      ) : null}
      {directory !== null && directory.entries.length > 0 ? (
        <>
          <div className={styles.section_heading}>
            <h2>
              <Bot aria-hidden="true" /> Robots{" "}
              <span>{directory.entries.length}</span>
            </h2>
            <p>Select a robot, then open its workspace.</p>
          </div>
          {directory.omitted_count > 0 ? (
            <p className={styles.notice}>
              Showing the first {directory.entries.length} stable Control
              identities. {directory.omitted_count} more are not subscribed on
              this overview.
            </p>
          ) : null}
          <section aria-label="Discovered robots" className={styles.grid}>
            {directory.entries.map((entry) => (
              <RobotCard entry={entry} key={entry.control_id} />
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
