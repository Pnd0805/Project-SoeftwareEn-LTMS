import { describe, it, expect } from "vitest";
import { toAnnouncementDto } from "../announcement.mapper.js";
import type { AnnouncementRow } from "../../types/db.js";

// Builds a fully-typed row; override only what each test cares about.
function makeRow(overrides: Partial<AnnouncementRow> = {}): AnnouncementRow {
    return {
        announcement_id: 1,
        tournament_id: 10,
        match_id: null,
        created_by: 5,
        announcement_type: "general",
        title: "Match schedule updated",
        content: "The semi-final has moved to 15:00.",
        created_at: new Date("2026-03-01T08:30:00.000Z"),
        updated_at: null,
        updated_by: null,
        deleted_at: null,
        deleted_by: null,
        ...overrides,
    };
}

describe("toAnnouncementDto", () => {
    it("maps DB column names to DTO field names", () => {
        const row = makeRow({
            announcement_id: 42,
            title: "Venue change",
            content: "We are moving to Hall B.",
        });

        const dto = toAnnouncementDto(row);

        expect(dto.id).toBe(42);
        expect(dto.title).toBe("Venue change");
        expect(dto.body).toBe("We are moving to Hall B.");
    });

    it("converts created_at (Date) to an ISO 8601 UTC string", () => {
        const row = makeRow({ created_at: new Date("2026-03-01T08:30:00.000Z") });

        expect(toAnnouncementDto(row).createdAt).toBe("2026-03-01T08:30:00.000Z");
    });

    it("keeps millisecond precision in createdAt", () => {
        const row = makeRow({ created_at: new Date("2026-03-01T08:30:00.123Z") });

        expect(toAnnouncementDto(row).createdAt).toBe("2026-03-01T08:30:00.123Z");
    });

    it("represents the same instant regardless of how the Date was constructed", () => {
        // +07:00 offset -> 01:30 UTC
        const row = makeRow({ created_at: new Date("2026-03-01T08:30:00+07:00") });

        expect(toAnnouncementDto(row).createdAt).toBe("2026-03-01T01:30:00.000Z");
    });

    it("returns only id, title, body and createdAt (no extra row fields leak)", () => {
        const row = makeRow({
            match_id: 7,
            updated_at: new Date("2026-03-02T00:00:00.000Z"),
            updated_by: 9,
            deleted_at: new Date("2026-03-03T00:00:00.000Z"),
            deleted_by: 9,
            announcement_type: "schedule_change",
        });

        const dto = toAnnouncementDto(row);

        expect(Object.keys(dto).sort()).toEqual(["body", "createdAt", "id", "title"]);
        expect(dto).toEqual({
            id: 1,
            title: "Match schedule updated",
            body: "The semi-final has moved to 15:00.",
            createdAt: "2026-03-01T08:30:00.000Z",
        });
    });

    it("does not depend on nullable/optional columns being null or set", () => {
        const withNulls = toAnnouncementDto(makeRow());
        const withValues = toAnnouncementDto(
            makeRow({
                match_id: 3,
                updated_at: new Date("2026-04-01T00:00:00.000Z"),
                updated_by: 2,
                deleted_at: new Date("2026-04-02T00:00:00.000Z"),
                deleted_by: 2,
            })
        );

        expect(withValues).toEqual(withNulls);
    });

    it("preserves title and content exactly (whitespace, unicode, empty strings)", () => {
        const row = makeRow({
            title: "  ประกาศ: เปลี่ยนสนาม 🏆  ",
            content: "line 1\nline 2\n",
        });

        const dto = toAnnouncementDto(row);

        expect(dto.title).toBe("  ประกาศ: เปลี่ยนสนาม 🏆  ");
        expect(dto.body).toBe("line 1\nline 2\n");

        const empty = toAnnouncementDto(makeRow({ title: "", content: "" }));
        expect(empty.title).toBe("");
        expect(empty.body).toBe("");
    });

    it("does not mutate the input row", () => {
        const row = makeRow();
        const snapshot = structuredClone(row);

        toAnnouncementDto(row);

        expect(row).toEqual(snapshot);
    });

    it("returns a new object on each call", () => {
        const row = makeRow();

        expect(toAnnouncementDto(row)).not.toBe(toAnnouncementDto(row));
    });

    it("throws a RangeError when created_at is an invalid Date", () => {
        const row = makeRow({ created_at: new Date("not a date") });

        expect(() => toAnnouncementDto(row)).toThrow(RangeError);
    });

    it("works with Array.prototype.map for lists of rows", () => {
        const rows = [
            makeRow({ announcement_id: 1, title: "A" }),
            makeRow({ announcement_id: 2, title: "B" }),
        ];

        const dtos = rows.map(toAnnouncementDto);

        expect(dtos.map((d) => d.id)).toEqual([1, 2]);
        expect(dtos.map((d) => d.title)).toEqual(["A", "B"]);
    });
});
