import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import app from "./index";
import { validateConfig } from "./services/validator";

// Sample config for testing
const SAMPLE_CONFIG = JSON.stringify(
	{
		startDate: "2025-11-20",
		dueDate: "2026-08-20",
		todayEmoji: "📍",
		milestones: [
			{
				date: "2025-11-20",
				label: "Start",
				emoji: "🌱",
				color: "blue",
				description: "Start of first trimester",
			},
			{
				date: "2026-08-20",
				label: "Due",
				emoji: "🐣",
				color: "red",
			},
		],
	},
	null,
	2,
);

// Track commits made during tests
let lastCommit: { content: string; message: string } | null = null;

// Mock GitHub module
vi.mock("./services/github", () => ({
	getConfig: vi.fn().mockImplementation(async () => SAMPLE_CONFIG),
	commitConfig: vi.fn().mockImplementation(async (_token, content, message) => {
		lastCommit = { content, message };
		return "https://github.com/test/repo/commit/abc123";
	}),
}));

// Load real API keys from environment or .dev.vars
const TEST_PIN = process.env.PIN || "1234";
const TEST_MISTRAL_KEY = process.env.MISTRAL_API_KEY;

// Create mock environment
const mockEnv = {
	PIN: TEST_PIN,
	MISTRAL_API_KEY: TEST_MISTRAL_KEY || "",
	GITHUB_TOKEN: "mock-github-token",
};

describe("Config Editor API", () => {
	beforeAll(() => {
		if (!TEST_MISTRAL_KEY) {
			console.warn(
				"⚠️  MISTRAL_API_KEY not set - Mistral tests will be skipped",
			);
		}
	});

	afterAll(() => {
		lastCommit = null;
	});

	describe("Health check", () => {
		it("GET / returns ok status", async () => {
			const res = await app.request("/", {}, mockEnv);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data).toEqual({ status: "ok" });
		});
	});

	describe("OpenAPI spec", () => {
		it("GET /openapi.json returns valid OpenAPI spec", async () => {
			const res = await app.request("/openapi.json", {}, mockEnv);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.openapi).toBe("3.1.0");
			expect(data.info.title).toBe("Meanwhile Config Editor API");
			expect(data.paths["/api/chat"]).toBeDefined();
		});
	});

	describe("Authentication", () => {
		it("returns 401 for invalid PIN", async () => {
			const res = await app.request(
				"/api/chat",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pin: "9999", message: "test" }),
				},
				mockEnv,
			);
			expect(res.status).toBe(401);
			const data = await res.json();
			expect(data.error).toBe("Invalid PIN");
		});

		it("returns 400 for missing message", async () => {
			const res = await app.request(
				"/api/chat",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pin: TEST_PIN, message: "" }),
				},
				mockEnv,
			);
			expect(res.status).toBe(400);
		});
	});

	describe.skipIf(!TEST_MISTRAL_KEY)("Mistral integration", () => {
		it("handles read-only query without modifying config", async () => {
			lastCommit = null;

			const res = await app.request(
				"/api/chat",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						pin: TEST_PIN,
						message: "What is the due date?",
					}),
				},
				mockEnv,
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.response).toBeDefined();
			expect(data.configUpdated).toBe(false);
			expect(lastCommit).toBeNull();
		}, 30000);

		it("handles edit query and commits to GitHub", async () => {
			lastCommit = null;

			const res = await app.request(
				"/api/chat",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						pin: TEST_PIN,
						message: "Add a milestone on 2026-03-01 called Test Event with emoji 🧪 and color subtle",
					}),
				},
				mockEnv,
			);

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.response).toBeDefined();
			expect(data.configUpdated).toBe(true);
			expect(data.commitUrl).toBe("https://github.com/test/repo/commit/abc123");

			// Verify the commit was made with valid JSON
			expect(lastCommit).not.toBeNull();
			const committedConfig = JSON.parse(lastCommit!.content);
			expect(committedConfig.milestones).toBeDefined();

			// Find the new milestone
			const newMilestone = committedConfig.milestones.find(
				(m: { label: string }) => m.label === "Test Event",
			);
			expect(newMilestone).toBeDefined();
			expect(newMilestone.date).toBe("2026-03-01");
			expect(newMilestone.emoji).toBe("🧪");
			expect(newMilestone.color).toBe("subtle");
		}, 30000);

		it("handles emoji in milestone labels correctly", async () => {
			lastCommit = null;

			const res = await app.request(
				"/api/chat",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						pin: TEST_PIN,
						message: "Add a birthday party milestone on 2026-04-01 with label Birthday 🎂 Party and emoji 🎉",
					}),
				},
				mockEnv,
			);

			expect(res.status).toBe(200);
			const data = await res.json();

			if (data.configUpdated) {
				// Verify UTF-8 encoding worked
				expect(lastCommit).not.toBeNull();
				const committedConfig = JSON.parse(lastCommit!.content);
				// Check that emojis are preserved
				const hasEmojiMilestone = committedConfig.milestones.some(
					(m: { emoji: string }) => m.emoji === "🎉",
				);
				expect(hasEmojiMilestone).toBe(true);
			}
		}, 30000);
	});
});

describe("Config Validator", () => {
	it("accepts valid config", () => {
		const result = validateConfig(SAMPLE_CONFIG);
		expect(result.valid).toBe(true);
	});

	it("rejects invalid JSON", () => {
		const result = validateConfig("not json");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid JSON");
	});

	it("rejects missing startDate", () => {
		const config = JSON.stringify({ dueDate: "2026-08-20", todayEmoji: "📍", milestones: [] });
		const result = validateConfig(config);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("startDate");
	});

	it("rejects invalid date format", () => {
		const config = JSON.stringify({
			startDate: "11/20/2025",
			dueDate: "2026-08-20",
			todayEmoji: "📍",
			milestones: [],
		});
		const result = validateConfig(config);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("startDate");
		expect(result.error).toContain("YYYY-MM-DD");
	});

	it("rejects milestone with missing date", () => {
		const config = JSON.stringify({
			startDate: "2025-11-20",
			dueDate: "2026-08-20",
			todayEmoji: "📍",
			milestones: [{ label: "Test", emoji: "🧪" }],
		});
		const result = validateConfig(config);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Milestone 1");
		expect(result.error).toContain("date");
	});

	it("rejects milestone with invalid endDate format", () => {
		const config = JSON.stringify({
			startDate: "2025-11-20",
			dueDate: "2026-08-20",
			todayEmoji: "📍",
			milestones: [{ date: "2026-01-01", endDate: "Jan 5 2026", label: "Test", emoji: "🧪" }],
		});
		const result = validateConfig(config);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("endDate");
		expect(result.error).toContain("YYYY-MM-DD");
	});

	it("rejects milestone with missing emoji", () => {
		const config = JSON.stringify({
			startDate: "2025-11-20",
			dueDate: "2026-08-20",
			todayEmoji: "📍",
			milestones: [{ date: "2026-01-01", label: "Test" }],
		});
		const result = validateConfig(config);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("emoji");
	});
});
