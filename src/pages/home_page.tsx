import { Card } from "../components/feedback/card";

export function HomePage() {
  return (
    <main>
      <h1>Home</h1>
      <Card>
        <h2>No robots discovered</h2>
        <p>Robot discovery begins after the Pilot stream hub is available.</p>
      </Card>
    </main>
  );
}
