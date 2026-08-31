/**
 * src/components/kit/chips.test.tsx
 *
 * เทสต์ตัวอย่างของโปรเจกต์ — และเป็นหลักฐานว่าการผ่า kit เป็นสองชั้นได้ผลจริง
 *
 * ประเด็นทั้งหมดอยู่ที่: ชั้น `*View` วาดได้โดย**ไม่มี store**
 * ถ้าใครเผลอเอา useLtms() กลับเข้าไปในชั้นล่าง เทสต์นี้จะพังทันที
 * เพราะ render โดยไม่มี provider ใดๆ ทั้งสิ้น
 */
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { TeamChipView, TeamLinkView } from "./chips"
import { toTeamView, type TeamView } from "./viewModels"
import type { Team } from "../../shared/types"

const byteForce: TeamView = {
  id: 11,
  name: "Byte Force",
  code: "BYT",
  color: "#E5484D",
  logoUrl: null,
}

describe("TeamChipView", () => {
  it("วาดชื่อทีมได้โดยไม่ต้องมี store", () => {
    render(<TeamChipView team={byteForce} />)
    expect(screen.getByText("Byte Force")).toBeInTheDocument()
  })

  it("ไม่มีทีม (ยังไม่รู้คู่แข่ง) แสดง TBD", () => {
    render(<TeamChipView team={null} />)
    expect(screen.getByText("TBD")).toBeInTheDocument()
  })
})

describe("TeamLinkView", () => {
  it("ลิงก์ไปหน้าทีมด้วย id ที่ได้รับ — รับได้ทั้ง id ตัวเลขจาก API", () => {
    render(<MemoryRouter><TeamLinkView team={byteForce} /></MemoryRouter>)
    expect(screen.getByRole("link", { name: /Byte Force/ })).toHaveAttribute("href", "/team/11")
  })
})

describe("toTeamView", () => {
  it("แปลง Team ของ prototype โดยย้าย logo → logoUrl", () => {
    const proto = {
      id: "t1", name: "Engineering United", code: "ENG", color: "#30A46C",
      leader: "u1", members: [], created: 0, disabled: false, permanent: false,
      logo: "https://example.test/eng.png",
    } as Team

    expect(toTeamView(proto)).toEqual({
      id: "t1",
      name: "Engineering United",
      code: "ENG",
      color: "#30A46C",
      logoUrl: "https://example.test/eng.png",
    })
  })

  it("ทีมที่ไม่มีโลโก้ได้ logoUrl เป็น null ไม่ใช่ undefined", () => {
    const proto = {
      id: "t2", name: "Circuit Breakers", code: "CIR", color: "#F5D90A",
      leader: "u2", members: [], created: 0, disabled: false, permanent: false,
    } as Team

    expect(toTeamView(proto).logoUrl).toBeNull()
  })
})
