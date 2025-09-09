import React from 'react';
import ClosedByAssigneeWidget from './widgets/ClosedByAssigneeWidget';
import TicketLifecycleWidget from './widgets/TicketLifecycleWidget';

export interface HistoryWidgetProps {
  // Each widget manages its own state
}

export interface HistoryWidget {
  id: string;
  title: string;
  enabled: boolean;
  Component: React.ComponentType<HistoryWidgetProps>;
}

export const historyWidgets: HistoryWidget[] = [
  {
    id: 'closed-by-assignee',
    title: 'Closed by Assignee',
    enabled: true,
    Component: ClosedByAssigneeWidget,
  },
  {
    id: 'ticket-lifecycle',
    title: 'Ticket Lifecycle',
    enabled: true,
    Component: TicketLifecycleWidget,
  },
  // Future widgets can be added here
  // {
  //   id: 'created-vs-closed',
  //   title: 'Created vs Closed',
  //   enabled: false,
  //   Component: CreatedVsClosedWidget,
  // },
  // {
  //   id: 'sla-breaches',
  //   title: 'SLA Breaches',
  //   enabled: false,
  //   Component: SLABreachesWidget,
  // },
];

export const getEnabledWidgets = (): HistoryWidget[] => {
  return historyWidgets.filter(widget => widget.enabled);
};

export default historyWidgets;
