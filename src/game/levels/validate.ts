import { levels } from "./index.ts";
import { formatLevelsValidationReport, validateLevels } from "./validation.ts";

const report = validateLevels(levels);
console.log(formatLevelsValidationReport(report));
