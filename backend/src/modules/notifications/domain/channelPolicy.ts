import { NotifyChannel } from '../../auth/application/ports';

/**
 * PATRÓN: Strategy (política por canal, RF-NOT-04). Cada canal decide qué medios de entrega usa;
 * los observadores `email` y `realtime-notification` la consultan en vez de tener `if` dispersos.
 */
export interface ChannelPolicy { push: boolean; email: boolean }

const POLICIES: Record<NotifyChannel, ChannelPolicy> = {
  IN_APP: { push: true, email: false },
  EMAIL: { push: false, email: true },
  BOTH: { push: true, email: true },
};

export const channelPolicy = (channel: NotifyChannel | undefined): ChannelPolicy => POLICIES[channel ?? 'BOTH'];
