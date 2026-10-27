export type TenantPlan = 'free' | 'team' | 'trial' | 'basic' | 'professional' | 'premium';

export const TEAM_PLAN_PRICE_LABEL = 'R$ 59,90/mês';
export const FREE_TEAM_LIMIT_MESSAGE = `O plano gratuito inclui 1 barbeiro ativo. Para adicionar mais profissionais, ative o plano Equipe por ${TEAM_PLAN_PRICE_LABEL} para toda a equipe com o suporte do AgendAI.`;

type PlanAccount = { plan?: string; account_status?: string };
type Professional = { id?: string; active?: boolean };

export const hasPaidTeamPlan = (org?: PlanAccount | null): boolean =>
  org?.account_status !== 'suspended' && ['team', 'basic', 'professional', 'premium'].includes(org?.plan || '');

export const activeProfessionals = (barbers?: Professional[]): Professional[] =>
  (Array.isArray(barbers) ? barbers : []).filter(barber => barber && barber.active !== false);

// Equipes antigas mantêm a capacidade atual; ampliar exige um plano pago.
export const exceedsFreeTeamLimit = (org: PlanAccount | undefined, incoming: Professional[], current: Professional[] = []): boolean => {
  if (hasPaidTeamPlan(org)) return false;
  return activeProfessionals(incoming).length > Math.max(1, activeProfessionals(current).length);
};
