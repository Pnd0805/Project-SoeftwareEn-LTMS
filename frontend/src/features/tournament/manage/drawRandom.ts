/** Fisher-Yates shuffle that also avoids presenting an unchanged redraw. */
export function randomizeDraw(ids: string[], current: string[], random = Math.random): string[] {
  const shuffled = [...ids]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  if (shuffled.length > 1 && shuffled.every((id, index) => id === current[index])) {
    shuffled.push(shuffled.shift() as string)
  }
  return shuffled
}
