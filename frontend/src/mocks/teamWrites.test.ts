/**
 * ทางเขียนของทีมในโหมด mock — กฎต้องบังคับที่ชั้นนี้ ไม่ใช่แค่ปิดปุ่ม
 *
 * seed: Byte Force (t-byt) ได้ที่นั่งใน ROV Online Clash ซึ่งเริ่มแข่งแล้ว → ล็อก
 *       Byte Force Academy (t-bfa, Badminton ลงสนาม 2 คน) ยังไม่ได้ที่นั่งในรายการไหน → แก้รายชื่อได้
 */
import { beforeEach, describe, expect, it } from "vitest";
import { getState, login, resetDemo } from "../shared/store";
import { positionOf } from "../shared/rules";
import { numOf } from "./storeBridge";
import {
  writeAnswerInvitation, writeCreateTeam, writeInviteMember, writeKickMember, writeSetMemberPosition,
  writeUpdateTeam,
} from "./teamWrites";

const team = (id: string) => getState().teams.find(t => t.id === id)!;
const aPlayerOf = (id: string) => team(id).members.find(m => m !== team(id).leader)!;

beforeEach(() => {
  resetDemo();
  login("u-lead");
});

describe("removing a player", () => {
  it("is refused once a tournament the squad holds a place in has started", () => {
    const target = aPlayerOf("t-byt");

    expect(writeKickMember("t-byt", numOf(target))).toMatchObject({ status: 409, code: "ROSTER_LOCKED" });
    expect(team("t-byt").members).toContain(target);
  });

  it("works before any tournament starts", () => {
    const target = aPlayerOf("t-bfa");

    expect(writeKickMember("t-bfa", numOf(target))).toBeNull();
    expect(team("t-bfa").members).not.toContain(target);
  });

  it("never removes the team leader", () => {
    expect(writeKickMember("t-bfa", numOf("u-lead"))).toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});

describe("adding a player", () => {
  it("is refused once the squad is locked", () => {
    expect(writeInviteMember("t-byt", numOf("u-ref"))).toMatchObject({ status: 409, code: "ROSTER_LOCKED" });
  });

  it("sends an invitation before any tournament starts", () => {
    expect(writeInviteMember("t-bfa", numOf("u-ref"))).toBeNull();
    expect(getState().invites.some(i => i.team === "t-bfa" && i.user === "u-ref" && i.status === "pending")).toBe(true);
  });

  it("refuses accepting an invitation sent before the lock", () => {
    const pending = getState().invites.find(i => i.team === "t-byt" && i.status === "pending")!;

    expect(writeAnswerInvitation(pending.id, true)).toMatchObject({ status: 409, code: "ROSTER_LOCKED" });
    expect(pending.status).toBe("pending");
    expect(team("t-byt").members).not.toContain(pending.user);
  });

  it("still lets the invited player decline while the squad is locked", () => {
    const pending = getState().invites.find(i => i.team === "t-byt" && i.status === "pending")!;

    expect(writeAnswerInvitation(pending.id, false)).toBe("t-byt");
  });
});

describe("starters and substitutes", () => {
  it("refuses more starters than the sport fields", () => {
    /* หัวหน้ากับคนที่สองเป็นตัวจริงอยู่แล้ว — Badminton ลงสนามได้ 2 คน */
    const third = team("t-bfa").members[2];

    expect(writeSetMemberPosition("t-bfa", numOf(third), "starter")).toMatchObject({ status: 422, code: "STARTERS_FULL" });
    expect(positionOf(team("t-bfa"), third)).toBe("substitute");
  });

  it("swaps a starter out and a substitute in", () => {
    const [, second, third] = team("t-bfa").members;

    expect(writeSetMemberPosition("t-bfa", numOf(second), "substitute")).toBeNull();
    expect(writeSetMemberPosition("t-bfa", numOf(third), "starter")).toBeNull();
    expect(positionOf(team("t-bfa"), second)).toBe("substitute");
    expect(positionOf(team("t-bfa"), third)).toBe("starter");
  });

  it("keeps everyone's position when somebody leaves", () => {
    const [, second, third] = team("t-bfa").members;
    writeSetMemberPosition("t-bfa", numOf(second), "substitute");
    writeSetMemberPosition("t-bfa", numOf(third), "starter");

    expect(writeKickMember("t-bfa", numOf(third))).toBeNull();
    /* ถ้าไม่ได้บันทึกตำแหน่งไว้ คนที่สองจะกลับเป็นตัวจริงเองเพราะลำดับขยับ */
    expect(positionOf(team("t-bfa"), second)).toBe("substitute");
  });
});

describe("editing the squad", () => {
  it("renames the squad and changes its code", () => {
    expect(writeUpdateTeam("t-bfa", { name: "Byte Force Juniors", code: "bfj" })).toBeNull();
    expect(team("t-bfa")).toMatchObject({ name: "Byte Force Juniors", code: "BFJ" });
  });

  it("refuses a name another squad in the same sport already uses", () => {
    expect(typeof writeCreateTeam({ name: "Shuttle Kings", sportTypeId: 5 })).toBe("number");
    expect(writeUpdateTeam("t-bfa", { name: "shuttle kings" })).toMatchObject({ status: 409, code: "TEAM_NAME_TAKEN" });
  });

  it("refuses an empty name or a malformed code", () => {
    expect(writeUpdateTeam("t-bfa", { name: "   " })).toMatchObject({ status: 400 });
    expect(writeUpdateTeam("t-bfa", { code: "B" })).toMatchObject({ status: 400 });
  });
});
