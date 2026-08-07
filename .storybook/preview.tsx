import type { Preview } from "storybook";
import "../src/styles/layers.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      defaultValue: "black",
      toolbar: { items: ["black", "light"] }
    }
  },
  decorators: [
    (Story, context) => (
      <div
        data-theme={context.globals.theme}
        style={{ minHeight: "100vh", padding: "32px" }}
      >
        <Story />
      </div>
    )
  ]
};

export default preview;
