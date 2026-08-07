import { useParams } from "react-router";
import { Card } from "../components/feedback/card";

export function JoggingPage() {
  const { control_id } = useParams();
  return (
    <main>
      <h1>Jogging</h1>
      <Card>
        <h2>{control_id}</h2>
        <p>
          The selected Control workspace is prepared before status integration.
        </p>
      </Card>
    </main>
  );
}
