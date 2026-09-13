/**
 * ทางเขียนฝั่ง Admin ในโหมด mock — กรรมการภายนอก (FR-RM-02) และบัญชีผู้ใช้ (FR-UM-05)
 *
 * seed: Prasert (u-ext) ตอบรับการแต่งตั้งใน Faculty Basketball Showdown แล้ว รอ Admin
 *       Malee (u-ext2) ได้รับเชิญในรายการเดียวกัน ยังไม่ตอบ
 */
import { beforeEach, describe, expect, it } from "vitest";
import { getState, login, resetDemo } from "../shared/store";
import { hardFilter } from "../shared/rules";
import { numOf } from "./storeBridge";
import { storeExternalRefereeRequests, storeTournamentReferees } from "./adminBridge";
import { mockLogin } from "./auth.mock";
import {
  writeAnswerRefereeInvite, writeAppointReferee, writeGrantAdminScope, writeRemoveReferee,
  writeReviewExternalReferee, writeRevokeAdminScope, writeSuspendUser,
} from "./adminWrites";

const tournament = (id: string) => getState().tournaments.find(t => t.id === id)!;
const invite = (id: string) => getState().refInvites.find(i => i.id === id)!;

beforeEach(() => {
  resetDemo();
  login("u-admin");
});

describe("external referees", () => {
  it("the seed has an external referee waiting on an admin", () => {
    expect(storeExternalRefereeRequests().map(r => r.referee.fullName)).toContain("Prasert Wongsuwan");
  });

  it("an external referee who accepts does not count until an admin approves", () => {
    writeAnswerRefereeInvite("ri-ext2", true);
    expect(invite("ri-ext2")).toMatchObject({ status: "accepted", approval: "pending" });
    expect(tournament("t-bkb").referees).not.toContain("u-ext2");

    expect(writeReviewExternalReferee("ri-ext2", true)).toBeNull();
    expect(tournament("t-bkb").referees).toContain("u-ext2");
    expect(storeTournamentReferees("t-bkb").find(r => r.user.id === numOf("u-ext2")))
      .toMatchObject({ isExternal: true, externalApprovalStatus: "approved", isActive: true });
  });

  it("a decline needs a reason and keeps the referee out", () => {
    expect(writeReviewExternalReferee("ri-ext1", false)).toMatchObject({ status: 400, code: "REJECT_REASON_REQUIRED" });
    expect(writeReviewExternalReferee("ri-ext1", false, "No referee licence on file")).toBeNull();

    expect(tournament("t-bkb").referees).not.toContain("u-ext");
    expect(storeTournamentReferees("t-bkb").find(r => r.user.id === numOf("u-ext")))
      .toMatchObject({ externalApprovalStatus: "rejected", isActive: false });
    expect(writeReviewExternalReferee("ri-ext1", true)).toMatchObject({ status: 409, code: "ALREADY_DECIDED" });
  });

  it("appointing someone from outside the university marks the invitation external", () => {
    login("u-org");
    writeAppointReferee("t-fut", "u-ext");

    expect(getState().refInvites.find(i => i.tour === "t-fut" && i.user === "u-ext")?.external).toBe(true);
  });
});

describe("removing and re-adding referees", () => {
  beforeEach(() => login("u-org"));

  const footballMatches = () => getState().matches.filter(m => m.tour === "t-fb");

  it("takes a referee off a tournament that is already being played, and off its unfinished matches", () => {
    const unfinished = footballMatches().filter(m => m.status !== "confirmed" && m.refs.includes("u-ref")).map(m => m.id);
    const finished = footballMatches().filter(m => m.status === "confirmed" && m.refs.includes("u-ref")).map(m => m.id);
    expect(unfinished.length).toBeGreaterThan(0);

    expect(writeRemoveReferee("t-fb", "u-ref")).toBeNull();

    expect(tournament("t-fb").referees).not.toContain("u-ref");
    expect(footballMatches().filter(m => unfinished.includes(m.id)).some(m => m.refs.includes("u-ref"))).toBe(false);
    expect(footballMatches().filter(m => finished.includes(m.id)).every(m => m.refs.includes("u-ref"))).toBe(true);
  });

  it("lets the organizer appoint the same person again straight away", () => {
    writeRemoveReferee("t-fb", "u-ref");
    writeAppointReferee("t-fb", "u-ref");

    expect(storeTournamentReferees("t-fb").find(r => r.user.id === numOf("u-ref")))
      .toMatchObject({ invitationStatus: "pending" });
  });

  it("withdraws an invitation nobody has answered", () => {
    expect(writeRemoveReferee("t-bkb", "u-ext2")).toBeNull();

    expect(storeTournamentReferees("t-bkb").some(r => r.user.id === numOf("u-ext2"))).toBe(false);
  });

  it("is the organizer's call, about someone on the tournament", () => {
    expect(writeRemoveReferee("t-fb", "u-play")).toMatchObject({ status: 404, code: "REFEREE_NOT_FOUND" });

    login("u-lead");
    expect(writeRemoveReferee("t-fb", "u-ref")).toMatchObject({ status: 403, code: "NOT_ORGANIZER" });
  });
});

describe("suspending an account", () => {
  it("needs a reason, and never suspends yourself or an admin", () => {
    expect(writeSuspendUser("u-play", true)).toMatchObject({ status: 400, code: "SUSPEND_REASON_REQUIRED" });
    expect(writeSuspendUser("u-admin", true, "testing")).toMatchObject({ status: 409, code: "CANNOT_SUSPEND_SELF" });
    expect(writeGrantAdminScope("u-org")).toBeNull();
    expect(writeSuspendUser("u-org", true, "testing")).toMatchObject({ status: 409, code: "USER_IS_ADMIN" });
  });

  it("blocks signing in and entering a tournament until reinstated", async () => {
    expect(writeSuspendUser("u-play", true, "Played under someone else's name")).toBeNull();
    await expect(mockLogin("player@ltms.test", "password123")).rejects.toMatchObject({ status: 403, code: "ACCOUNT_SUSPENDED" });

    const s = getState();
    const fails = hardFilter(s, s.teams.find(t => t.id === "t-byt")!, tournament("t-rov"), ["u-play"]);
    expect(fails.map(f => f.rule)).toContain("Suspended");

    expect(writeSuspendUser("u-play", false)).toBeNull();
    await expect(mockLogin("player@ltms.test", "password123")).resolves.toMatchObject({ user: { fullName: "Mongkol Thanit" } });
  });
});

describe("admin rights", () => {
  it("grants once, and never revokes your own rights", () => {
    expect(writeGrantAdminScope("u-org")).toBeNull();
    expect(writeGrantAdminScope("u-org")).toMatchObject({ status: 409, code: "ALREADY_ADMIN" });
    expect(writeRevokeAdminScope(numOf("u-admin") + 1)).toMatchObject({ status: 409, code: "CANNOT_REVOKE_SELF" });
    expect(writeRevokeAdminScope(numOf("u-org") + 1)).toBeNull();
  });

  it("does not make a suspended or external account an admin", () => {
    writeSuspendUser("u-play", true, "testing");

    expect(writeGrantAdminScope("u-play")).toMatchObject({ status: 409, code: "USER_SUSPENDED" });
    expect(writeGrantAdminScope("u-ext")).toMatchObject({ status: 409, code: "USER_IS_EXTERNAL" });
  });
});
