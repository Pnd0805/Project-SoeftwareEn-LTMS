/**
 * src/components/kit/Scorebug.test.tsx
 *
 * ล็อกจุดที่เกือบพลาดตอนผ่า Scorebug เป็นสองชั้น
 *
 * ฉบับร่างแรกของ `ScorebugView` คำนวณเองว่าฝั่งไหนแพ้จาก `scoreA < scoreB`
 * ซึ่งพังทันทีกับแมตช์ที่เสมอแล้วตัดสินด้วยจุดโทษ — 2–2 แต่มีคนแพ้จริง
 * ตัวตัดสินคือ `winnerId()` ใน rules.ts ซึ่งอ่าน `m.decider` ไม่ใช่สกอร์
 *
 * ⚠️ seed.ts ไม่ได้สร้างแมตช์ที่มี decider เลยสักนัด เส้นทางนี้จึงกดดูในแอปไม่ได้
 *    เทสต์นี้คือที่เดียวที่กันการถอยกลับไปคำนวณจากสกอร์อีก
 */
import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { ScorebugView } from "./Scorebug"
import type { TeamView } from "./viewModels"

const home: TeamView = { id: "t1", name: "Science", code: "SCI", color: "#30A46C", logoUrl: null }
const away: TeamView = { id: "t2", name: "Education", code: "EDU", color: "#E5484D", logoUrl: null }

const draw = (props: Partial<Parameters<typeof ScorebugView>[0]> = {}) =>
  render(
    <MemoryRouter>
      <ScorebugView home={home} away={away} scoreA={2} scoreB={2} tag="Semi-final" decided {...props} />
    </MemoryRouter>,
  )

const scores = (c: HTMLElement) => [...c.querySelectorAll(".sb-score")].map(el => el.className)

describe("ScorebugView", () => {
  it("เสมอ 2–2 แต่แพ้จุดโทษ — ฝั่งที่แพ้ต้องถูกหรี่ ทั้งที่สกอร์เท่ากัน", () => {
    const { container } = draw({
      decider: { a: 5, b: 4, kind: "Penalties" },
      homeLost: false,
      awayLost: true,
    })
    const [a, b] = scores(container)
    expect(a).not.toContain("lost")
    expect(b).toContain("lost")
  })

  it("ไม่เดาเองจากสกอร์ — สกอร์เท่ากันแต่ไม่บอกว่าใครแพ้ ต้องไม่หรี่ใครเลย", () => {
    const { container } = draw()
    expect(scores(container).every(c => !c.includes("lost"))).toBe(true)
  })

  it("มี decider แสดง AET ไม่ใช่ FT", () => {
    const { container } = draw({ decider: { a: 5, b: 4, kind: "Penalties" } })
    expect(container.querySelector(".sb-clock")?.textContent).toBe("AET")
  })

  it("ยังไม่จบ แสดง vs และไม่หรี่ใคร", () => {
    const { container } = draw({ scoreA: null, scoreB: null, decided: false })
    expect(container.querySelector(".sb-clock")?.textContent).toBe("vs")
    expect(scores(container).every(c => !c.includes("lost"))).toBe(true)
  })

  it("ยังไม่รู้คู่แข่ง แสดง To be decided ไม่ระเบิด", () => {
    const { container } = draw({ away: null, scoreB: null })
    expect(container.textContent).toContain("To be decided")
  })
})
