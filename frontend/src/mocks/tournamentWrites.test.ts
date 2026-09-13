/**
 * ทางเขียนของหน้าจัดการทัวร์นาเมนต์ในโหมด mock — ปุ่มพวกนี้เคยกดแล้วเงียบ
 * เพราะหน้าจอส่ง Number('t-bkb') = NaN ให้ API ที่รู้จักแต่ fixture ตัวเลข
 *
 * seed: Faculty Basketball Showdown (t-bkb) ยัง private มีกรรมการตอบรับ 1 ใน 2
 *       Faculty Football Cup (t-fb) public มีทีมได้ที่นั่ง 8 ทีม ผู้จัดคือ u-org ทั้งคู่
 */
import { beforeEach, describe, expect, it } from "vitest";
import { getState, login, resetDemo } from "../shared/store";
import {
  storeAnnouncementDtos, writeEntryNotes, writePostAnnouncement, writePublishTournament,
  writeRequestFilterChange, writeSendFeedback,
} from "./tournamentWrites";

const tour = (id: string) => getState().tournaments.find(t => t.id === id)!;

beforeEach(() => {
  resetDemo();
  login("u-org");
});

describe("opening a tournament to the public", () => {
  it("waits until enough referees can officiate", () => {
    expect(writePublishTournament("t-bkb")).toMatchObject({ status: 409, code: "REFEREES_NOT_READY" });
    expect(tour("t-bkb").status).toBe("private");
  });

  it("opens once the referees are in", () => {
    tour("t-bkb").referees.push("u-ref2");

    expect(writePublishTournament("t-bkb")).toBeNull();
    expect(tour("t-bkb").status).toBe("public");
  });

  it("is the organizer's call only", () => {
    tour("t-bkb").referees.push("u-ref2");
    login("u-lead");

    expect(writePublishTournament("t-bkb")).toMatchObject({ status: 403, code: "NOT_ORGANIZER" });
  });
});

describe("announcements", () => {
  it("posts to the tournament and tells the approved team leaders", () => {
    const before = getState().notifications.length;

    expect(typeof writePostAnnouncement("t-fb", "Semi-finals move to 3pm", "The pitch is being re-lined.")).toBe("string");
    expect(storeAnnouncementDtos("t-fb")?.[0]).toMatchObject({ title: "Semi-finals move to 3pm" });
    expect(getState().notifications.length).toBeGreaterThan(before);
  });

  it("needs a headline", () => {
    expect(writePostAnnouncement("t-fb", "   ", "body")).toMatchObject({ status: 400 });
  });

  it("reads the announcements already in the seed", () => {
    expect(storeAnnouncementDtos("t-fb")?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("entry conditions", () => {
  it("saves the soft filter", () => {
    expect(writeEntryNotes("t-fb", "Bring your student card.")).toBeNull();
    expect(tour("t-fb").entryNotes).toBe("Bring your student card.");
  });

  it("sends a hard-filter change to an admin, with a reason, once", () => {
    const rules = { ...tour("t-fb").rules, ageMax: 30 };

    expect(writeRequestFilterChange("t-fb", rules, "   ")).toMatchObject({ status: 400 });
    expect(writeRequestFilterChange("t-fb", rules, "Postgraduates asked to join")).toBeNull();
    expect(tour("t-fb").filterChangeRequest).toMatchObject({ reason: "Postgraduates asked to join" });
    expect(writeRequestFilterChange("t-fb", rules, "Asking again")).toMatchObject({ status: 409 });
  });
});

describe("feedback", () => {
  it("lets a player rate a tournament but not its own organizer", () => {
    expect(writeSendFeedback("t-fb", 4, "Well run")).toMatchObject({ status: 403 });

    login("u-lead");
    expect(writeSendFeedback("t-fb", 4, "Well run")).toBeNull();
    expect(getState().feedback.some(f => f.tour === "t-fb" && f.by === "u-lead" && f.rating === 4)).toBe(true);
  });
});
