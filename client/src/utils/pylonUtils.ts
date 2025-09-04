// Pylon views (fixed)
export const PYLON_VIEWS = {
  ALL: 'https://app.usepylon.com/issues/views/all-issues',
  MY: 'https://app.usepylon.com/issues/views/719091e8-7520-40b0-bbf8-a505d909cc25',
  UNASSIGNED: 'https://app.usepylon.com/issues/views/8d19d5d0-04f7-4d1e-8bc8-c18c7eb42db9',
  CLOSED_BY_ASSIGNEE: 'https://app.usepylon.com/issues/views/34ffbe38-df11-41b8-9d1a-603e291e005b', // date filter must be adjusted manually in Pylon
};

export const openPylon = (url: string) =>
  window.open(url, '_blank', 'noopener,noreferrer');

// Helper for ticket assignment table links
export const resolveAssignmentLink = (
  row: { isTotals?: boolean; name?: string; email?: string },
  columnKey: 'new' | 'waiting' | 'hold' | 'closedToday' | 'totalOpen',
  currentUserEmail: string
) => {
  if (columnKey === 'closedToday') return PYLON_VIEWS.CLOSED_BY_ASSIGNEE;
  if (row.isTotals) return PYLON_VIEWS.ALL;
  if (row.name?.toLowerCase() === 'unassigned') return PYLON_VIEWS.UNASSIGNED;
  if (row.email && row.email === currentUserEmail) return PYLON_VIEWS.MY;
  return PYLON_VIEWS.ALL;
};
