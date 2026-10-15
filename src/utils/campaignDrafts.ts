import { campaignTemplates, type CampaignAudience } from './campaigns';

type Drafts = Record<CampaignAudience, string>;
type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>;
const keyFor = (orgId: string) => `agendai:campaign-drafts:v1:${encodeURIComponent(orgId)}`;

export function loadCampaignDrafts(orgId: string, storage: DraftStorage): { drafts: Drafts; error: boolean } {
  const drafts = { ...campaignTemplates };
  try {
    if (!orgId) return { drafts, error: true };
    const raw = storage.getItem(keyFor(orgId));
    if (raw === null) return { drafts, error: false };
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { drafts, error: true };
    for (const audience of Object.keys(drafts) as CampaignAudience[]) {
      const value = (saved as Record<string, unknown>)[audience];
      // Empty drafts are deliberate and must not be replaced by a template.
      if (typeof value === 'string') drafts[audience] = value;
    }
    return { drafts, error: false };
  } catch {
    return { drafts, error: true };
  }
}

export function saveCampaignDrafts(orgId: string, drafts: Drafts, storage: DraftStorage): boolean {
  try {
    if (!orgId) return false;
    storage.setItem(keyFor(orgId), JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}
