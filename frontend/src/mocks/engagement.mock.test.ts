import { beforeEach, describe, expect, it } from "vitest"
import { pickScore } from "../shared/career"
import { getState, resetDemo } from "../shared/store"
import { getMockComments, mockPostComment, mockRemoveComment } from "./comment.mock"
import { getMockPicks, mockPlacePick } from "./pick.mock"

describe("engagement mocks", () => {
  beforeEach(() => resetDemo())

  it("reads seeded comments and keeps posts/removals in the shared store", () => {
    const seeded = getState().comments[0]
    expect(seeded).toBeDefined()
    expect(getMockComments(seeded.match).items.some(comment => comment.id === seeded.id)).toBe(true)

    const posted = mockPostComment(seeded.match, "u-org", "ignored", " New comment ").items.at(-1)
    expect(posted?.text).toBe("New comment")
    expect(getState().comments.some(comment => comment.id === posted?.id)).toBe(true)

    mockRemoveComment(seeded.match, posted!.id)
    expect(getState().comments.some(comment => comment.id === posted?.id)).toBe(false)
  })

  it("writes picks to the same source read by the match UI and token calculation", () => {
    const match = getState().matches.find(item =>
      item.status === "scheduled" && item.checkedIn.length === 0 && item.a && item.b,
    )
    expect(match).toBeDefined()
    mockPlacePick(match!.id, "u-play", match!.a!)
    expect(getMockPicks(match!.id, "u-play").mine?.teamId).toBe(match!.a)
    expect(getState().picks.some(pick => pick.match === match!.id && pick.by === "u-play")).toBe(true)
    expect(pickScore(getState(), "u-play")).toMatchObject({ total: 1, held: 1 })
  })
})
