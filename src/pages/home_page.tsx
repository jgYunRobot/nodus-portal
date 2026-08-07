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
        <h1>Home</h1>
        <p>
          Robots publicly discovered from Pilot RobotStatus stream descriptors.
        </p>
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
          message="Pilot has not published any RobotStatus streams."
          title="No robots discovered"
        />
      ) : null}
      {directory !== null && directory.entries.length > 0 ? (
        <>
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
