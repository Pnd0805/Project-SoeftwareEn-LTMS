import { expect, it } from 'vitest'
import { isKuEmail } from './kuEmail'

it.each(['student@ku.th', 'Student@KU.TH'])('recognizes the delivered internal domain for %s', email => {
  expect(isKuEmail(email)).toBe(true)
})
it.each(['student@gmail.com', 'student@notku.th', 'student@fake-ku.th', 'student@sub.ku.th', 'ku.th', 'student@ku.th.example'])('does not send %s to student details', email => {
  expect(isKuEmail(email)).toBe(false)
})
