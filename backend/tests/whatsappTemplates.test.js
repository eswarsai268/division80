import "./syntheticBackendEnv.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WHATSAPP_TEMPLATES } = require("../src/services/whatsapp_templates.js");

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe("approved WhatsApp templates", () => {
    it("lists only the six configured templates with exact approved bodies", async () => {
        vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "synthetic-token");
        vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456");
        vi.stubEnv("WHATSAPP_BUSINESS_ACCOUNT_ID", "654321");
        vi.stubEnv("WHATSAPP_API_VERSION", "v17.0");

        const approved = Object.values(WHATSAPP_TEMPLATES).map((template) => ({
            name: template.name,
            language: template.language,
            category: template.category,
            status: "APPROVED",
            components: [{ type: "BODY", text: template.body }],
        }));
        approved.push({
            name: "unconfigured_template",
            language: "te",
            status: "APPROVED",
            components: [{ type: "BODY", text: "Not one of the six configured messages." }],
        });
        approved.push({
            name: WHATSAPP_TEMPLATES.div79_candidate_intro.name,
            language: "te",
            status: "APPROVED",
            components: [{ type: "BODY", text: "Different content under a configured template name." }],
        });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: approved }),
        }));

        const { listApprovedTemplates } = require("../src/services/whatsapp.js");
        const templates = await listApprovedTemplates();

        expect(templates).toHaveLength(6);
        expect(templates.map(({ name }) => name).sort()).toEqual(
            Object.values(WHATSAPP_TEMPLATES).map(({ name }) => name).sort(),
        );
        expect(templates.every((template) => template.supported)).toBe(true);
        expect(templates.find((template) => template.name === "div79_candidate_intro").title)
            .toBe("Candidate Introduction");
    });
});
