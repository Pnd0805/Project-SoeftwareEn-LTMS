/**
 * FR-DL-01 — สรุปสถานะแมตช์และหัวตารางของแดชบอร์ดทัวร์นาเมนต์
 */
import { describe, expect, it } from "vitest";
import type { StandingRowDto } from "../../types/match.dto";
import { stateOf, summarizeMatches, topOfTable, type DashboardMatch } from "./dashboardView";

const team = (id: number) => ({ id, name: `Team ${id}`, code: `T${id}`, color: null, logoUrl: null, players: [] });

const match = (id: number, over: Partial<DashboardMatch> = {}): DashboardMatch => ({
  id,
  roundNumber: 0,
  stage: "Semi-final",
  tag: `SF${id}`,
  teamA: team(1),
  teamB: team(2),
  scheduledTime: null,
  status: "scheduled",
  resultStatus: null,
  score: null,
  ...over,
}) as unknown as DashboardMatch;

const items = [
  match(1, { status: "completed", resultStatus: "verified", scheduledTime: "2026-02-01T10:00:00+07:00", score: { a: 2, b: 1 } }),
  match(2, { status: "completed", resultStatus: "verified", scheduledTime: "2026-02-02T10:00:00+07:00", score: { a: 0, b: 3 } }),
  match(3, { status: "in_progress", scheduledTime: "2026-02-05T10:00:00+07:00" }),
  match(4, { status: "checkin_open", scheduledTime: "2026-02-05T09:00:00+07:00" }),
  match(5, { status: "disputed" }),
  match(6, { resultStatus: "submitted" }),
  match(7, { roundNumber: 1, stage: "Final", tag: "F1", scheduledTime: "2026-02-09T10:00:00+07:00" }),
  match(8, { roundNumber: 1, stage: "Final", tag: "F2", scheduledTime: "2026-02-08T10:00:00+07:00" }),
  match(9, { roundNumber: 2, stage: "Grand final", teamB: null }),
  match(10, { teamB: null, status: "completed", resultStatus: "verified" }),
];

describe("summarizeMatches", () => {
  const s = summarizeMatches(items);

  it("counts every state and leaves byes out of the total", () => {
    expect(s.total).toBe(9);
    expect(s.finished).toBe(2);
    expect(s.byState).toMatchObject({ confirmed: 2, live: 1, checkin: 1, disputed: 1, pending: 1, scheduled: 2, waiting: 1, bye: 1 });
  });

  it("lists what is on now and what needs a decision", () => {
    expect(s.onNow.map(m => m.id)).toEqual([4, 3]);
    expect(s.attention.map(m => m.id)).toEqual([5, 6]);
  });

  it("orders up next by kick-off and latest results newest first", () => {
    expect(s.upNext.map(m => m.id)).toEqual([8, 7]);
    expect(s.latest.map(m => m.id)).toEqual([2, 1]);
  });

  it("names the earliest stage that still has matches to finish", () => {
    expect(s.stage).toBe("Semi-final");
    expect(summarizeMatches(items.filter(m => (m.roundNumber ?? 0) > 0)).stage).toBe("Final");
  });

  it("limits the lists", () => {
    expect(summarizeMatches(items, 1).upNext).toHaveLength(1);
  });
});

describe("stateOf", () => {
  it("treats a completed match with no result status as confirmed, the way the backend reports it", () => {
    const fromBackend = match(11, { status: "completed" });
    delete (fromBackend as Partial<DashboardMatch>).resultStatus;

    expect(stateOf(fromBackend)).toBe("confirmed");
  });

  it("keeps a submitted result as awaiting confirmation", () => {
    expect(stateOf(match(12, { resultStatus: "submitted" }))).toBe("pending");
  });
});

describe("topOfTable", () => {
  const row = (id: number, rank: number, outLabel = "") =>
    ({ team: team(id), rank, played: 0, won: 0, lost: 0, points: 0, outLabel, form: [] }) as unknown as StandingRowDto;

  it("lists the squads still in an elimination bracket instead of a column of first places", () => {
    const top = topOfTable([row(1, 1, "Still in"), row(2, 1, "Still in"), row(3, 1, "Still in"), row(4, 4, "Quarter-final")], "single_elimination");

    expect(top.kind).toBe("still-in");
    expect(top.kind === "still-in" ? top.teams.map(r => r.team.id) : []).toEqual([1, 2, 3]);
  });

  it("ranks a finished bracket and keeps squads tied on the last place shown", () => {
    const top = topOfTable([row(1, 1, "Champion"), row(2, 2, "Final"), row(3, 3, "Semi-final"), row(4, 3, "Semi-final"), row(5, 5, "Quarter-final")], "single_elimination");

    expect(top.kind === "ranked" ? top.rows.map(r => r.team.id) : []).toEqual([1, 2, 3, 4]);
  });

  it("ranks a round robin by the table even when first place is shared", () => {
    const top = topOfTable([row(1, 1), row(2, 1), row(3, 3), row(4, 4)], "round_robin");

    expect(top.kind === "ranked" ? top.rows.map(r => r.team.id) : []).toEqual([1, 2, 3]);
  });
});
