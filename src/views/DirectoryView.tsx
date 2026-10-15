import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CalendarCheck2, LocateFixed, MapPin, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { PublicThemeToggle } from '../components/common/PublicThemeToggle';
import { BRAZIL_STATES, type DirectoryEntry } from '../utils/directory';
import { getClientBookingUrl } from '../config/urls';
import type { AppThemeMode } from '../config/theme';
import { PageSeo } from '../components/common/PageSeo';

type DirectoryResponse = { items?: DirectoryEntry[]; hasMore?: boolean; error?: string };

const initialFilters = { q: '', city: '', state: '', neighborhood: '' };

type DirectoryFilters = typeof initialFilters;
type DirectoryLocation = { latitude: number; longitude: number } | null;

const numberFromSearch = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const readDirectoryUrlState = (): { filters: DirectoryFilters; page: number; location: DirectoryLocation } => {
  const params = new URLSearchParams(window.location.search);
  const latitude = numberFromSearch(params.get('latitude'));
  const longitude = numberFromSearch(params.get('longitude'));
  return {
    filters: {
      q: params.get('q') || '',
      city: params.get('city') || '',
      state: (params.get('state') || '').toUpperCase(),
      neighborhood: params.get('neighborhood') || '',
    },
    page: Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1),
    location: latitude === null || longitude === null ? null : { latitude, longitude },
  };
};

interface DirectoryViewProps {
  appThemeMode: AppThemeMode;
  onThemeModeChange: (mode: AppThemeMode) => void;
}

export const DirectoryView = ({ appThemeMode, onThemeModeChange }: DirectoryViewProps) => {
  const [filters, setFilters] = useState<DirectoryFilters>(() => readDirectoryUrlState().filters);
  const [appliedFilters, setAppliedFilters] = useState<DirectoryFilters>(() => readDirectoryUrlState().filters);
  const [items, setItems] = useState<DirectoryEntry[]>([]);
  const [page, setPage] = useState(() => readDirectoryUrlState().page);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<DirectoryLocation>(() => readDirectoryUrlState().location);
  const [locationMessage, setLocationMessage] = useState('');
  const cityInputRef = useRef<HTMLInputElement>(null);

  const writeDirectoryUrl = useCallback((nextFilters: DirectoryFilters, nextPage: number, nextLocation: DirectoryLocation, method: 'pushState' | 'replaceState' = 'pushState') => {
    const params = new URLSearchParams();
    if (nextFilters.q.trim()) params.set('q', nextFilters.q.trim());
    if (nextFilters.city.trim()) params.set('city', nextFilters.city.trim());
    if (nextFilters.state.trim()) params.set('state', nextFilters.state.trim().toUpperCase());
    if (nextFilters.neighborhood.trim()) params.set('neighborhood', nextFilters.neighborhood.trim());
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextLocation) {
      params.set('latitude', String(nextLocation.latitude));
      params.set('longitude', String(nextLocation.longitude));
    }
    const query = params.toString();
    window.history[method]({ directory: true }, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  const query = useMemo(() => new URLSearchParams({
    ...appliedFilters,
    page: String(page),
    ...(location ? { latitude: String(location.latitude), longitude: String(location.longitude) } : {}),
  }), [appliedFilters, page, location]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void fetch(`/api/directory?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = response.headers.get('content-type')?.includes('application/json')
          ? await response.json() as DirectoryResponse
          : {} as DirectoryResponse;
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar as barbearias.');
        if (!Array.isArray(body.items)) throw new Error('O diretório estará disponível assim que o painel for publicado.');
        return body;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        const received = Array.isArray(body.items) ? body.items : [];
        setItems((current) => page === 1 ? received : [...current, ...received]);
        setHasMore(body.hasMore === true);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as barbearias.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query]);

  useEffect(() => {
    const restoreDirectoryState = () => {
      const next = readDirectoryUrlState();
      setFilters(next.filters);
      setAppliedFilters(next.filters);
      setPage(next.page);
      setLocation(next.location);
      setLocationMessage(next.location ? 'Mostrando barbearias em até 50 km da sua localização.' : '');
    };
    window.addEventListener('popstate', restoreDirectoryState);
    return () => window.removeEventListener('popstate', restoreDirectoryState);
  }, []);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    const nextFilters = { ...filters, state: filters.state.toUpperCase() };
    writeDirectoryUrl(nextFilters, 1, location);
    setPage(1);
    setAppliedFilters(nextFilters);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Seu navegador não oferece localização. Use a busca por cidade.');
      return;
    }
    setLocationMessage('Solicitando sua localização…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = { latitude: Number(coords.latitude.toFixed(6)), longitude: Number(coords.longitude.toFixed(6)) };
        writeDirectoryUrl(appliedFilters, 1, nextLocation);
        setPage(1);
        setLocation(nextLocation);
        setLocationMessage('Mostrando barbearias em até 50 km da sua localização.');
      },
      () => setLocationMessage('Localização não autorizada. Você ainda pode buscar por cidade ou bairro.'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const showAll = () => {
    writeDirectoryUrl(appliedFilters, 1, null);
    setLocation(null);
    setLocationMessage('');
    setPage(1);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    writeDirectoryUrl(appliedFilters, nextPage, location);
    setPage(nextPage);
  };

  return (
    <main className="directory-view public-platform-view min-h-screen bg-[var(--public-page-bg)] text-[var(--public-text)]">
      <PageSeo
        title="Barbearias perto de você | Agendamento online no AgendAI"
        description="Encontre barbearias, conheça serviços e profissionais e faça seu agendamento online pelo AgendAI."
        path="/barbearias"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Diretório de barbearias do AgendAI',
          url: 'https://meuagendai.fun/barbearias',
          description: 'Diretório de barbearias com agendamento online.',
          inLanguage: 'pt-BR',
          isPartOf: { '@type': 'WebSite', name: 'AgendAI', url: 'https://meuagendai.fun/' },
        }}
      />
      <header className="directory-header border-b border-white/10 bg-[#070B14]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-3" aria-label="Voltar ao AgendAI">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white p-1"><BrandLogo variant="mark" className="h-full w-full" /></span>
            <span className="text-sm font-black tracking-tight text-white">AgendAI <span className="font-medium text-slate-400">para clientes</span></span>
          </a>
          <div className="flex items-center gap-2">
            <PublicThemeToggle mode={appThemeMode} onChange={onThemeModeChange} />
            <a href="/" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-bold text-white transition hover:bg-white/10"><ArrowLeft className="h-4 w-4" /> Área da barbearia</a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16">
        <div className="max-w-2xl animate-riseIn">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#FFC400]">Encontre sua próxima experiência</p>
          <h1 className="font-display mt-3 text-4xl font-normal tracking-[-.035em] text-white sm:text-5xl">Barbearias perto de você.</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">Explore estabelecimentos que escolheram aparecer no AgendAI. Abra a página da barbearia e faça seu agendamento online.</p>
        </div>

        <div className="mt-7 flex flex-wrap gap-2" aria-label="Atalhos de busca">
          <button type="button" onClick={showAll} className={`directory-filter-chip inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-bold transition ${!location ? 'directory-filter-chip--active border-[#FFC400]/60 bg-[#FFC400] text-[#07111F]' : 'border-white/10 bg-white/[.035] text-slate-300 hover:bg-white/[.08]'}`}><Sparkles className="h-3.5 w-3.5" /> Todas</button>
          <button type="button" onClick={useCurrentLocation} className={`directory-filter-chip directory-filter-chip--location inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-bold transition ${location ? 'directory-filter-chip--selected border-cyan-300 bg-cyan-300 text-[#07111F]' : 'border-cyan-400/30 bg-cyan-400/[.08] text-cyan-100 hover:bg-cyan-400/[.15]'}`}><LocateFixed className="h-3.5 w-3.5" /> Perto de mim</button>
          <button type="button" onClick={() => cityInputRef.current?.focus()} className="directory-filter-chip inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-4 text-xs font-bold text-slate-300 transition hover:bg-white/[.08]"><MapPin className="h-3.5 w-3.5" /> Buscar por cidade</button>
        </div>

        <form onSubmit={applyFilters} className="directory-search-card mt-4 rounded-3xl border border-white/10 bg-white/[.035] p-4 shadow-2xl sm:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_115px_minmax(0,1fr)_auto]">
            <label className="relative block"><span className="sr-only">Buscar barbearia</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Nome da barbearia" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0B1120] py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#FFC400]/70" /></label>
            <label className="relative block"><span className="sr-only">Cidade</span><MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input ref={cityInputRef} value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} placeholder="Cidade" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0B1120] py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#FFC400]/70" /></label>
            <label><span className="sr-only">Estado</span><select value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 text-sm text-white outline-none transition focus:border-[#FFC400]/70"><option value="">UF</option>{BRAZIL_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
            <label className="relative block"><span className="sr-only">Bairro</span><SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={filters.neighborhood} onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })} placeholder="Bairro" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0B1120] py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#FFC400]/70" /></label>
            <button type="submit" className="directory-search-submit inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FFC400] px-5 text-sm font-black text-[#07111F] transition hover:bg-[#ffd333]"><Search className="h-4 w-4" /> Buscar</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <button type="button" onClick={useCurrentLocation} className="directory-location-action inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 font-bold text-cyan-100 transition hover:bg-cyan-400/20"><LocateFixed className="h-4 w-4" /> Usar minha localização</button>
            {location && <button type="button" onClick={showAll} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 px-3 font-semibold text-slate-300 transition hover:bg-white/10"><X className="h-3.5 w-3.5" /> Ver todas</button>}
            {locationMessage && <span className="text-slate-400">{locationMessage}</span>}
          </div>
        </form>

        <div className="mt-8 flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#FFC400]">{location ? 'Em sua região' : 'Agendamento online'}</p><h2 className="mt-1 text-lg font-black text-white">Barbearias disponíveis</h2></div>{!loading && <p aria-live="polite" className="text-xs text-slate-500">{items.length} encontradas nesta busca</p>}</div>
        {error && <div role="alert" className="mt-4 rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}
        {loading && page === 1 ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((key) => <div key={key} className="h-56 animate-pulse rounded-3xl border border-white/10 bg-white/[.04]" />)}</div> : (
          <>
            {!error && items.length === 0 && <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/[.025] px-6 py-14 text-center"><Building2 className="mx-auto h-8 w-8 text-[#FFC400]" /><h3 className="mt-4 font-bold text-white">Nenhuma barbearia encontrada</h3><p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">Tente outra cidade, bairro ou uma busca mais ampla.</p></div>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((shop, index) => <article key={shop.slug} style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }} className="directory-card group flex min-h-60 animate-riseIn flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0B1120] transition hover:-translate-y-1 hover:border-[#FFC400]/35 hover:shadow-[0_18px_45px_rgba(0,0,0,.25)]">
                <div className="directory-card-hero relative h-20 border-b border-white/[.07] bg-[radial-gradient(circle_at_20%_10%,rgba(255,196,0,.22),transparent_45%),linear-gradient(120deg,#16233a,#0b1120)]"><span className="directory-card-badge absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200"><CalendarCheck2 className="h-3 w-3" /> Agenda online</span></div>
                <div className="relative flex flex-1 flex-col p-5"><div className="-mt-11 flex items-start gap-3"><div className="directory-card-logo organization-avatar relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-[#0B1120] bg-[#FFC400]/15 text-sm font-black text-[#FFC400] shadow-lg"><span aria-hidden="true">{shop.name.slice(0, 2).toUpperCase()}</span>{shop.logo && <img src={shop.logo} alt={`Logo ${shop.name}`} className="profile-avatar absolute inset-0" loading="lazy" decoding="async" onError={({ currentTarget }) => { currentTarget.style.display = 'none'; }} />}</div><div className="min-w-0 pt-3"><h3 className="truncate font-black text-white">{shop.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3.5 w-3.5 text-[#FFC400]" />{shop.city} · {shop.state}{shop.neighborhood ? ` · ${shop.neighborhood}` : ''}</p></div></div>
                {shop.address && <p className="mt-5 line-clamp-2 text-xs leading-relaxed text-slate-500">{shop.address}</p>}
                <a href={getClientBookingUrl(shop.slug)} className="directory-card-cta mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#FFC400]/50 bg-[#FFC400]/10 px-4 text-sm font-bold text-[#ffe071] transition group-hover:bg-[#FFC400] group-hover:text-[#07111F]">Ver serviços e agendar <ArrowRight className="h-4 w-4" /></a></div>
              </article>)}
            </div>
          </>
        )}
        {hasMore && !error && <div className="mt-8 text-center"><button type="button" disabled={loading} onClick={loadMore} className="min-h-11 rounded-xl border border-white/15 px-5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50">{loading ? 'Carregando...' : 'Carregar mais barbearias'}</button></div>}
      </section>
    </main>
  );
};
