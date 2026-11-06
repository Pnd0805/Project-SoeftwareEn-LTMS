import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Tabs } from './primitives'

it('announces selected local buttons and allows ordinary Tab and Space selection', async () => {
  function LocalTabs() {
    const [active, setActive] = useState('members')
    return <Tabs tabs={[{key:'members',label:'Members'},{key:'invites',label:'Invites'}]} active={active} onPick={setActive} />
  }
  const user = userEvent.setup()
  render(<LocalTabs />)
  expect(screen.getByRole('button', { name: 'Members' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Invites' })).toHaveAttribute('aria-pressed', 'false')
  await user.tab()
  expect(screen.getByRole('button', { name: 'Members' })).toHaveFocus()
  await user.tab()
  await user.keyboard(' ')
  expect(screen.getByRole('button', { name: 'Invites' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Members' })).toHaveAttribute('aria-pressed', 'false')
})
