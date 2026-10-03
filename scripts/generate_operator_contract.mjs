import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const output_path = "src/api/operator/generated/operator_v1.ts";
execFileSync(
  "npx",
  [
    "openapi-typescript",
    "contracts/operator/v1/openapi.yaml",
    "-o",
    output_path
  ],
  { stdio: "inherit" }
);
const generated_source = readFileSync(output_path, "utf8");
writeFileSync(output_path, `// @ts-nocheck\n${generated_source}`, "utf8");
