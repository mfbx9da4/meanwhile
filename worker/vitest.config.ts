import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "fs";

// Load .dev.vars if it exists
function loadDevVars(): Record<string, string> {
	const devVarsPath = ".dev.vars";
	if (!existsSync(devVarsPath)) {
		return {};
	}

	const content = readFileSync(devVarsPath, "utf-8");
	const vars: Record<string, string> = {};

	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const [key, ...valueParts] = trimmed.split("=");
		if (key && valueParts.length > 0) {
			vars[key.trim()] = valueParts.join("=").trim();
		}
	}

	return vars;
}

const devVars = loadDevVars();

export default defineConfig({
	test: {
		environment: "node",
		env: {
			...devVars,
		},
		testTimeout: 60000,
	},
});
