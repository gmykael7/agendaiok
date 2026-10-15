import type { Service } from '../types';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function filterServiceCatalog(services: Service[], query: string, category: string): Service[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return services.filter(service => service.active !== false
    && (!category || service.category === category)
    && words.every(word => normalize(`${service.name} ${service.description || ''} ${service.category}`).includes(word)));
}
