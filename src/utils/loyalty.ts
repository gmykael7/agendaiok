import { Client, Organization } from '../types';

export const DEFAULT_LOYALTY_TARGET = 10;
export const DEFAULT_LOYALTY_REWARD = '1 Corte Grátis';

export function getLoyaltyTarget(org?: Partial<Organization> | null): number {
  const target = Number(org?.loyalty_target_stamps);
  return Number.isFinite(target) && target >= 2 ? target : DEFAULT_LOYALTY_TARGET;
}

export function getLoyaltyRewardDescription(org?: Partial<Organization> | null): string {
  const desc = org?.loyalty_reward_description?.trim();
  return desc || DEFAULT_LOYALTY_REWARD;
}

export interface LoyaltyProgress {
  target: number;
  stamps: number;
  rewardsAvailable: number;
  remaining: number;
  progressPercent: number;
  rewardDescription: string;
  isEnabled: boolean;
  hasReward: boolean;
}

export function calculateLoyaltyProgress(
  client?: Partial<Client> | null,
  org?: Partial<Organization> | null
): LoyaltyProgress {
  const target = getLoyaltyTarget(org);
  const rewardDescription = getLoyaltyRewardDescription(org);
  const isEnabled = org?.loyalty_enabled !== false;

  // Carimbos acumulados no ciclo atual (0 até target - 1)
  const currentStamps = client?.loyalty_stamps !== undefined
    ? Math.max(0, Number(client.loyalty_stamps)) % target
    : Math.max(0, Number(client?.total_visits || 0)) % target;

  const rewardsAvailable = Math.max(0, Number(client?.loyalty_rewards_available || 0));
  const remaining = Math.max(0, target - currentStamps);
  const progressPercent = Math.min(100, Math.round((currentStamps / target) * 100));

  return {
    target,
    stamps: currentStamps,
    rewardsAvailable,
    remaining,
    progressPercent,
    rewardDescription,
    isEnabled,
    hasReward: rewardsAvailable > 0,
  };
}

export function addLoyaltyStampToClient(
  client: Client,
  org?: Partial<Organization> | null
): { updatedClient: Client; completedCycle: boolean } {
  const target = getLoyaltyTarget(org);
  const currentStamps = client.loyalty_stamps !== undefined
    ? Math.max(0, Number(client.loyalty_stamps))
    : Math.max(0, Number(client.total_visits || 0)) % target;

  const nextStamps = currentStamps + 1;
  const currentRewards = Math.max(0, Number(client.loyalty_rewards_available || 0));
  const currentPoints = Math.max(0, Number(client.loyalty_points || 0));

  if (nextStamps >= target) {
    return {
      completedCycle: true,
      updatedClient: {
        ...client,
        loyalty_stamps: 0,
        loyalty_rewards_available: currentRewards + 1,
        loyalty_points: currentPoints + 10,
      },
    };
  }

  return {
    completedCycle: false,
    updatedClient: {
      ...client,
      loyalty_stamps: nextStamps,
      loyalty_points: currentPoints + 10,
    },
  };
}

export function redeemLoyaltyRewardFromClient(client: Client): Client {
  const currentRewards = Math.max(0, Number(client.loyalty_rewards_available || 0));
  if (currentRewards <= 0) return client;

  const currentRedeemed = Math.max(0, Number(client.loyalty_total_redeemed || 0));
  return {
    ...client,
    loyalty_rewards_available: currentRewards - 1,
    loyalty_total_redeemed: currentRedeemed + 1,
  };
}
