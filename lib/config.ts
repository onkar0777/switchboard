import type { SwitchboardConfig } from "./verdicts/types";
import defaultConfig from "../switchboard.config";

// Optional gitignored override for personal dogfooding. Webpack emits a
// "Module not found" *warning* (not an error) when the file is absent; the
// try/catch swallows the runtime require failure. When the file is present,
// Next.js's TS-aware loader compiles it like any other source file.
let resolved: SwitchboardConfig = defaultConfig;
try {
  const local = require("../switchboard.config.local");
  resolved = (local.default ?? local) as SwitchboardConfig;
} catch {
  // No local override; use the committed default.
}

export default resolved;
