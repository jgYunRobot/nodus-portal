import js from "@eslint/js";
import react_hooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
      "storybook-static",
      "src/api/pilot/generated",
      "src/api/operator/generated"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser
    },
    plugins: {
      "react-hooks": react_hooks
    },
    rules: react_hooks.configs.recommended.rules
  },
  {
    files: ["vite.config.ts"],
    languageOptions: {
      globals: globals.node
    }
  }
);
