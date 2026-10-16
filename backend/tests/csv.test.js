import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/services/csv.js";

describe("CSV parser", () => {
    it("parses quoted delimiters, escaped quotes, and CRLF rows", () => {
        expect(parseCsv('name,address\r\n"Sam, Jr.","12 \"\"Main\"\" St"\r\n'))
            .toEqual([["name", "address"], ["Sam, Jr.", '12 "Main" St']]);
    });

    it.each([
        ['name\n"unfinished', "unclosed quoted field"],
        ['name\nSam" Jr.,Street', "quote inside an unquoted field"],
        ['name\n"Sam" Jr.,Street', "characters after a closing quote"],
    ])("rejects malformed CSV: %s", (csv) => {
        expect(() => parseCsv(csv)).toThrow(SyntaxError);
    });
});
