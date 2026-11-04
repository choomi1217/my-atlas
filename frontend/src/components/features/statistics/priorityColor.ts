import { TicketPriority } from '@/types/features';

export const priorityColor: Record<TicketPriority, string> = {
  [TicketPriority.HIGHEST]: 'bg-red-100 text-red-800',
  [TicketPriority.HIGH]: 'bg-orange-100 text-orange-800',
  [TicketPriority.MEDIUM]: 'bg-yellow-100 text-yellow-800',
  [TicketPriority.LOW]: 'bg-blue-100 text-blue-700',
  [TicketPriority.LOWEST]: 'bg-gray-100 text-gray-600',
};
