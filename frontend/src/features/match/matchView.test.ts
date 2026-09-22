/**
 * ภาษากลางของสไลซ์ 3 — สถานะแมตช์ · คิวงานของกรรมการ · สกอร์เป็นข้อความ
 *
 * เน้นกรณีที่ backend เพิ่งเปิดทางให้เกิดบ่อยขึ้น: แมตช์ที่จบโดยไม่ได้แข่ง
 * (บาย / แพ้ทั้งคู่ / แมตช์ตาย) และโหมดออนไลน์ที่คนกรอกผลคนแรกไม่ใช่กรรมการ
 */
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchStateBadge } from "../../components/kit/primitives";
import type { MatchListItemDto } from "../../types/match.dto";
import { isOpen, matchStateOf, outcomeNote, refBucketOf, scoreText } from "./matchView";

const team = (id: number) => ({ id, name: `Team ${id}`, code: `T${id}`, color: null, logoUrl: null, players: [] });

const match = (over: Partial<MatchListItemDto> = {}): MatchListItemDto => ({
  id: 1,
  teamA: team(1),
  teamB: team(2),
  status: "scheduled",
  mode: "onsite",
  resultStatus: null,
  score: null,
  outcome: null,
  roomCode: null,
  ...over,
}) as unknown as MatchListItemDto;

describe("matchStateOf", () => {
  it("counts a walkover as decided, not as waiting for a score", () => {
    expect(matchStateOf(match({ status: "completed", resultStatus: "walkover" }))).toBe("confirmed");
  });

  /* R16 — ผู้จัดยกผลทิ้งแล้วแมตช์ไป `result_rejected` เดิมตกลงมาเป็น "Scheduled"
     ซึ่งอ่านว่ายังไม่เคยมีอะไรเกิดขึ้น ทั้งที่แข่งไปแล้วและผลเพิ่งถูกเพิกถอน */
  it("does not read a thrown-out result as a match that has not happened", () => {
    const thrown = match({ status: "result_rejected", resultStatus: "rejected" });
    const state = matchStateOf(thrown);
    expect(state).not.toBe("scheduled");
    expect(state).toBe("rejected");

    const { unmount } = render(createElement(MatchStateBadge, { state }));
    expect(screen.getByText("Result thrown out")).toBeInTheDocument();
    unmount();
  });

  it("reads a bye as decided even though the other slot is empty", () => {
    const bye = match({
      status: "completed", teamB: null, resultStatus: "walkover",
      outcome: { kind: "bye", winnerTeamId: 1, loserTeamId: null },
    });
    expect(matchStateOf(bye)).toBe("confirmed");
  });

  it("reads a double forfeit as decided even with no result row at all", () => {
    const dead = match({
      status: "completed", resultStatus: null,
      outcome: { kind: "void", winnerTeamId: null, loserTeamId: null },
    });
    expect(matchStateOf(dead)).toBe("confirmed");
  });

  it("still asks for a score when a finished match has no result and no outcome", () => {
    expect(matchStateOf(match({ status: "completed" }))).toBe("pending");
  });
});

describe("isOpen", () => {
  it("drops a walkover out of the queue", () => {
    expect(isOpen(match({ status: "completed", resultStatus: "walkover" }))).toBe(false);
  });

  it("drops a match that was closed without a result row", () => {
    const dead = match({
      status: "completed", resultStatus: null,
      outcome: { kind: "void", winnerTeamId: null, loserTeamId: null },
    });
    expect(isOpen(dead)).toBe(false);
  });

  it("keeps a disputed match and one that is still waiting on a score", () => {
    expect(isOpen(match({ status: "disputed", resultStatus: "disputed" }))).toBe(true);
    expect(isOpen(match({ status: "completed" }))).toBe(true);
  });
});

describe("refBucketOf", () => {
  it("asks the referee for the score on site", () => {
    expect(refBucketOf(match({ mode: "onsite", status: "in_progress" }))).toBe("score");
  });

  /* โหมดออนไลน์หัวหน้าทีมที่ชนะกรอกก่อน กรรมการเป็นคนยืนยัน — ถ้าแถวรายการอ้างว่าเป็น
     on-site (M04 ไม่ส่ง mode) นัดนี้จะถูกสั่งให้กรรมการกรอกสกอร์เอง ซึ่งผิดหน้าที่ */
  it("does not ask an online referee for a score", () => {
    expect(refBucketOf(match({ mode: "online", status: "in_progress" }))).not.toBe("score");
  });

  it("sends an online submission to the referee to confirm", () => {
    expect(refBucketOf(match({ mode: "online", resultStatus: "submitted" }))).toBe("confirm");
  });
});

describe("scoreText", () => {
  it("writes dashes when there is no result, not zeros", () => {
    expect(scoreText(match())).toBe("— – —");
  });

  it("says what happened when a match ended without being played", () => {
    expect(scoreText(match({ outcome: { kind: "bye", winnerTeamId: 1, loserTeamId: null } }))).toBe("Bye");
    expect(scoreText(match({ outcome: { kind: "void", winnerTeamId: null, loserTeamId: null } }))).toBe("No contest");
  });

  /* สกอร์บายเป็นสกอร์ประจำกีฬา (บาส 20–0 แบด 2–0) ตัวเลขล้วนอ่านเหมือนแข่งจริง */
  it("marks a walkover score as a walkover", () => {
    const wo = match({ score: { a: 2, b: 0 }, outcome: { kind: "walkover", winnerTeamId: 1, loserTeamId: 2 } });
    expect(scoreText(wo)).toBe("2 – 0 · W/O");
  });

  it("leaves a played score alone", () => {
    const played = match({ score: { a: 3, b: 1 }, outcome: { kind: "played", winnerTeamId: 1, loserTeamId: 2 } });
    expect(scoreText(played)).toBe("3 – 1");
    expect(outcomeNote(played)).toBeNull();
  });
});
