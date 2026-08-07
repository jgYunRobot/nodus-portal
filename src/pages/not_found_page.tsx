import { Link } from "react-router";
import { Button } from "../components/actions/button";
import { Card } from "../components/feedback/card";

export function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <Card>
        <p>This Portal route is not implemented.</p>
        <Button>
          <Link to="/home">Go to Home</Link>
        </Button>
      </Card>
    </main>
  );
}
