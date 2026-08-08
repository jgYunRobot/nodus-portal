import { Card } from "../components/feedback/card";
import styles from "./device_page.module.css";

export function DevicePage() {
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h1>Device directory</h1>
          <p>Discover connected provider devices independently of any robot.</p>
        </div>
      </div>
      <Card>
        <h2>No devices discovered yet</h2>
        <p>
          The device deck will show supported Camera, Operator, and provider
          components registered through Pilot.
        </p>
      </Card>
    </main>
  );
}
