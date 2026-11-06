/**
 * กฎล็อกรายชื่อทีม — shared/rules.ts rosterLockOf / joinFails
 *
 * ก่อนรายการที่ทีมได้ที่นั่งเริ่มแข่ง หัวหน้าทีมเพิ่มและถอนผู้เล่นได้ หลังเริ่มล็อก
 * จนรายการจบ · ใช้ seed จริงเพื่อให้กฎกับข้อมูลเดโมตรงกัน
 */
import { describe, expect, it } from "vitest";
import { SEED } from "./seed";
import { joinFails, rosterLockOf } from "./rules";
import type { State, Tournament } from "./types";

const teamOf = (s: State, id: string) => s.teams.find(t => t.id === id)!;
const rovCup = (s: State) => s.tournaments.find(t => /ROV Online Clash/i.test(t.name))!;

describe("roster lock", () => {
  it("locks a squad once a tournament it holds a place in has started", () => {
    const s = SEED();
    expect(rosterLockOf(s, teamOf(s, "t-byt"))?.name).toMatch(/ROV Online Clash/i);
  });

  it("leaves the roster open before that tournament starts", () => {
    const s = SEED();
    s.matches.filter(m => m.tour === rovCup(s).id).forEach(m => {
      m.kickoff = "";
      m.checkedIn = [];
      m.status = "scheduled";
    });
    expect(rosterLockOf(s, teamOf(s, "t-byt"))).toBeNull();
  });

  it("reopens the roster once the tournament names a champion", () => {
    const s = SEED();
    rovCup(s).champion = "t-byt";
    expect(rosterLockOf(s, teamOf(s, "t-byt"))).toBeNull();
  });

  it("never locks a squad that holds no approved place", () => {
    const s = SEED();
    expect(rosterLockOf(s, teamOf(s, "t-bfa"))).toBeNull();
  });
});

describe("joining before the start", () => {
  it("refuses a newcomer who fails the entry rules of a tournament the squad already holds a place in", () => {
    const s = SEED();
    const academy = teamOf(s, "t-bfa");
    const upcoming: Tournament = {
      ...rovCup(s),
      id: "t-upcoming",
      name: "Upcoming Cup",
      drawn: false,
      champion: null,
      rules: { gender: "any", ageMin: 18, ageMax: 25, faculty: "any", major: "any", year: "any" },
    };
    s.tournaments.push(upcoming);
    s.registrations.push({ id: "r-upcoming", tour: upcoming.id, team: academy.id, status: "approved", at: 0, squad: academy.members.slice() });

    /* Mongkol เกิดปี 2009 — ตกกฎอายุ 18–25 */
    const found = joinFails(s, academy, "u-play");
    expect(found).toHaveLength(1);
    expect(found[0].tournament.id).toBe("t-upcoming");
    expect(found[0].fails.map(f => f.rule)).toContain("Age");

    /* Kittipong อายุ 21 ผ่าน */
    expect(joinFails(s, academy, "u-ref")).toEqual([]);
  });
});
