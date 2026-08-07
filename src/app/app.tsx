import "./app.css";
import { ThemeMenu } from "../components/actions/theme_menu";
import { Card } from "../components/feedback/card";
import { StatusBadge } from "../components/feedback/status_badge";

export function App() {
  return (
    <main className="bootstrap_surface">
      <header className="bootstrap_header">
        <div>
          <p className="bootstrap_eyebrow">Nodus Portal</p>
          <h1>Portal foundation ready</h1>
        </div>
        <ThemeMenu />
      </header>
      <Card>
        <StatusBadge label="Foundation" tone="neutral" />
        <p>Routes and Pilot integration are introduced in later checkpoints.</p>
      </Card>
    </main>
  );
}
