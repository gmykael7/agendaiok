import { test } from 'node:test';
import assert from 'node:assert/strict';

const DEFAULT_LOYALTY_TARGET = 10;
const DEFAULT_LOYALTY_REWARD = '1 Corte Grátis';

function getLoyaltyTarget(org) {
  const target = Number(org?.loyalty_target_stamps);
  return Number.isFinite(target) && target >= 2 ? target : DEFAULT_LOYALTY_TARGET;
}

function calculateLoyaltyProgress(client, org) {
  const target = getLoyaltyTarget(org);
  const rewardDescription = org?.loyalty_reward_description?.trim() || DEFAULT_LOYALTY_REWARD;
  const isEnabled = org?.loyalty_enabled !== false;

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

function addLoyaltyStampToClient(client, org) {
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

function redeemLoyaltyRewardFromClient(client) {
  const currentRewards = Math.max(0, Number(client.loyalty_rewards_available || 0));
  if (currentRewards <= 0) return client;

  const currentRedeemed = Math.max(0, Number(client.loyalty_total_redeemed || 0));
  return {
    ...client,
    loyalty_rewards_available: currentRewards - 1,
    loyalty_total_redeemed: currentRedeemed + 1,
  };
}

test('cálculo de progresso padrão do Cartão Fidelidade (10 cortes)', () => {
  const org = { loyalty_enabled: true };
  const client = { total_visits: 4, loyalty_stamps: 4, loyalty_rewards_available: 0 };

  const progress = calculateLoyaltyProgress(client, org);
  assert.equal(progress.target, 10);
  assert.equal(progress.stamps, 4);
  assert.equal(progress.remaining, 6);
  assert.equal(progress.progressPercent, 40);
  assert.equal(progress.rewardDescription, '1 Corte Grátis');
  assert.equal(progress.hasReward, false);
});

test('acúmulo de carimbos e conclusão de ciclo (ganha 1 recompensa)', () => {
  const org = { loyalty_target_stamps: 5, loyalty_reward_description: 'Barba Grátis' };
  let client = { id: 'c-1', name: 'Lucas', phone: '11999998888', loyalty_stamps: 4, loyalty_rewards_available: 0 };

  // Lucas tem 4 carimbos de uma meta de 5. Ao fazer o 5º corte:
  const result = addLoyaltyStampToClient(client, org);
  assert.equal(result.completedCycle, true, 'Deve indicar que o ciclo foi concluído');
  assert.equal(result.updatedClient.loyalty_stamps, 0, 'Carimbos devem reiniciar em 0 para o novo ciclo');
  assert.equal(result.updatedClient.loyalty_rewards_available, 1, 'Deve conceder 1 recompensa');
});

test('resgate de recompensa diminui saldo e incrementa histórico', () => {
  const client = {
    id: 'c-2',
    name: 'Marcos',
    loyalty_stamps: 2,
    loyalty_rewards_available: 2,
    loyalty_total_redeemed: 1,
  };

  const redeemed = redeemLoyaltyRewardFromClient(client);
  assert.equal(redeemed.loyalty_rewards_available, 1);
  assert.equal(redeemed.loyalty_total_redeemed, 2);

  // Tentando resgatar com saldo 0
  const emptyClient = { ...redeemed, loyalty_rewards_available: 0 };
  const failedRedeem = redeemLoyaltyRewardFromClient(emptyClient);
  assert.equal(failedRedeem.loyalty_rewards_available, 0);
  assert.equal(failedRedeem.loyalty_total_redeemed, 2);
});
