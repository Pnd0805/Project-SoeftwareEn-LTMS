/** Mock owns its role locally; real mode trusts only a backend capability check. */
export const canShowAdminNav = (
  useMock: boolean,
  mockRole: string | undefined,
  backendHasAdminAccess: boolean,
) => useMock ? mockRole === 'Admin' : backendHasAdminAccess
