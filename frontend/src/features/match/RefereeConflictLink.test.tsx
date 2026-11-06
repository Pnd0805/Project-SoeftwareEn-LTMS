import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { RefereeConflictLink } from './RefereeConflictLink'
it('uses only the personal conflict returned by BE and opens the existing withdrawal flow', () => {
  render(<MemoryRouter><RefereeConflictLink error={new ApiError(409, { code: 'REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT', message: 'Overlaps', conflictsWith: { matchId: 8 } })} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: /request withdrawal/ })).toHaveAttribute('href', '/m/8');
});
it('does not invent a match link for missing or invalid details', () => {
  render(<MemoryRouter><RefereeConflictLink error={new ApiError(409, { code: 'REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT', message: 'Overlaps', conflictsWith: { matchId: '8' } })} /></MemoryRouter>);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
