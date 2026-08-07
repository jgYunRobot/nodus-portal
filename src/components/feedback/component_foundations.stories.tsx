import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/button";
import { Card } from "./card";
import { ErrorPanel } from "./error_panel";
import { Skeleton } from "./skeleton";
import { StatusBadge } from "./status_badge";

const meta = { title: "Foundations/Feedback", component: Card } satisfies Meta<
  typeof Card
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const States: Story = {
  args: { children: "Foundation states" },
  render: () => (
    <Card>
      <h2>Foundation states</h2>
      <p>
        <StatusBadge label="Ready" tone="success" />
      </p>
      <p>
        <StatusBadge label="Stale" tone="warning" />
      </p>
      <Skeleton label="Loading robot summary" />
      <p>
        <Button>Primary action</Button>
      </p>
      <ErrorPanel
        message="Retry after the connection recovers."
        title="Pilot unavailable"
      />
    </Card>
  )
};
