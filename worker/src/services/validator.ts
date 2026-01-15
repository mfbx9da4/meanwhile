import { z } from "@hono/zod-openapi";

// ISO date format: YYYY-MM-DD
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD format");

// Milestone schema
const milestoneSchema = z.object({
	date: isoDateSchema,
	endDate: isoDateSchema.optional(),
	label: z.string().min(1, "Label is required"),
	emoji: z.string().min(1, "Emoji is required"),
	color: z.string().optional(),
	description: z.string().optional(),
});

// Full config schema
const configSchema = z.object({
	startDate: isoDateSchema,
	dueDate: isoDateSchema,
	todayEmoji: z.string().min(1, "todayEmoji is required"),
	milestones: z.array(milestoneSchema),
});

export type ConfigJSON = z.infer<typeof configSchema>;

type ValidationResult = {
	valid: boolean;
	error?: string;
};

export function validateConfig(configString: string): ValidationResult {
	// Try to parse as JSON
	let parsed: unknown;
	try {
		parsed = JSON.parse(configString);
	} catch {
		return { valid: false, error: "Invalid JSON syntax" };
	}

	// Validate with zod
	const result = configSchema.safeParse(parsed);

	if (!result.success) {
		// Format the first error nicely
		const issue = result.error.issues[0];
		const path = issue.path.join(".");

		// Make milestone errors more readable
		if (path.startsWith("milestones.")) {
			const match = path.match(/^milestones\.(\d+)\.(.+)$/);
			if (match) {
				const [, index, field] = match;
				return {
					valid: false,
					error: `Milestone ${Number(index) + 1} ${field}: ${issue.message}`,
				};
			}
		}

		return {
			valid: false,
			error: path ? `${path}: ${issue.message}` : issue.message,
		};
	}

	return { valid: true };
}

// Export schema for potential reuse
export { configSchema, milestoneSchema };
