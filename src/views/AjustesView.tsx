import React, { useRef, useState } from 'react';
import { 
  Settings, Users, Scissors, Building2, Palette,
  ShieldCheck, Boxes, MessageSquare
} from 'lucide-react';
import { Organization, Service, Barber, Appointment, CurrentUser, Product, ProductSale } from '../types';
import { TeamView } from './TeamView';
import { ServicesView } from './ServicesView';
import { SettingsView } from './SettingsView';
import { UsersPermissionsView } from './UsersPermissionsView';
import { ProductsView } from './ProductsView';
import { WhatsAppSettingsSection } from '../components/settings/WhatsAppSettingsSection';
import { INITIAL_ORG, INITIAL_SERVICES, INITIAL_BARBERS, INITIAL_APPOINTMENTS } from '../data/mockData';
import { AppThemeMode, AppThemePreference } from '../config/theme';

type SettingsSubTab = 'team' | 'services' | 'products' | 'general' | 'appearance' | 'users' | 'whatsapp';

interface AjustesViewProps {
  initialTab?: 'team' | 'services' | 'general' | 'appearance';
  org: Organization;
  setOrg: React.Dispatch<React.SetStateAction<Organization>>;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  barbers: Barber[];
  setBarbers: React.Dispatch<React.SetStateAction<Barber[]>>;
  appointments: Appointment[];
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  productSales: ProductSale[];
  setProductSales: React.Dispatch<React.SetStateAction<ProductSale[]>>;
  onLoadDemo: (demoData: {
    org: Organization;
    services: Service[];
    barbers: Barber[];
    appointments: Appointment[];
  }) => void;
  onResetAll: () => void;
  currentUser?: CurrentUser;
  appThemeMode: AppThemeMode;
  setAppThemeMode: React.Dispatch<React.SetStateAction<AppThemeMode>>;
  appThemePreference: AppThemePreference;
  followSystemTheme: () => void;
}

export const AjustesView: React.FC<AjustesViewProps> = ({
  initialTab = 'team',
  org,
  setOrg,
  services,
  setServices,
  barbers,
  setBarbers,
  appointments,
  products,
  setProducts,
  productSales,
  setProductSales,
  onLoadDemo,
  onResetAll,
  currentUser,
  appThemeMode,
  setAppThemeMode,
  appThemePreference,
  followSystemTheme,
}) => {
  const [subTab, setSubTab] = useState<SettingsSubTab>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);

  const navigateToSubTab = (tab: SettingsSubTab) => {
    setSubTab(tab);
    requestAnimationFrame(() => {
      const scrollContainer = document.querySelector<HTMLElement>('.admin-scroll-content');
      const content = contentRef.current;
      if (!scrollContainer || !content) return;

      const targetTop = scrollContainer.scrollTop
        + content.getBoundingClientRect().top
        - scrollContainer.getBoundingClientRect().top
        - 12;

      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  };

  return (
    <div className="app-view space-y-6 animate-fadeIn">
      {/* CABEÇALHO GERAL DE AJUSTES */}
      <div className="bg-[#121B2E] p-5 sm:p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-emerald-400" />
            Painel de Ajustes & Configurações
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gerencie equipe, serviços, produtos físicos, estoque, comissões e dados do salão.
          </p>
        </div>
      </div>

      {/* NAVEGAÇÃO POR SUB-ABAS MOBILE */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {[
          { id: 'team', label: 'Equipe', detail: `${barbers.length} ${barbers.length === 1 ? 'profissional' : 'profissionais'}`, icon: Users, visible: true },
          { id: 'services', label: 'Serviços', detail: `${services.length} cadastrados`, icon: Scissors, visible: true },
          { id: 'products', label: 'Produtos', detail: `${products.length} ${products.length === 1 ? 'item' : 'itens'} em estoque`, icon: Boxes, visible: currentUser?.permissions?.products !== false },
          { id: 'users', label: 'Usuários', detail: 'Permissões', icon: ShieldCheck, visible: currentUser?.permissions?.usuarios !== false },
          { id: 'general', label: 'Perfil e horários', detail: 'Configurações gerais', icon: Building2, visible: true },
          { id: 'appearance', label: 'Aparência', detail: 'Temas, cores e estilo', icon: Palette, visible: true },
          { id: 'whatsapp', label: 'WhatsApp', detail: 'Conectar número', icon: MessageSquare, visible: true },
        ].filter((item) => item.visible).map((item) => {
          const Icon = item.icon;
          const isActive = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateToSubTab(item.id as SettingsSubTab)}
              className={`min-h-[82px] rounded-2xl border p-3.5 text-left transition-all active:scale-95 ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                  : 'bg-[#121B2E] text-slate-300 border-slate-800 active:border-slate-600'
              }`}
              aria-pressed={isActive}
            >
              <span className="flex items-center gap-2 font-bold text-xs">
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </span>
              <span className={`block mt-1.5 text-[10px] ${isActive ? 'text-emerald-300 font-semibold' : 'text-slate-400'}`}>
                {item.detail}
              </span>
            </button>
          );
        })}
      </div>

      {/* NAVEGAÇÃO POR SUB-ABAS DESKTOP */}
      <div className="hidden sm:grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7 gap-2 bg-[#121B2E] p-1.5 rounded-2xl border border-slate-800 shadow-sm">
        <button
          onClick={() => navigateToSubTab('team')}
          className={`flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-center text-xs font-bold transition-all active:scale-95 ${
            subTab === 'team'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Barbeiros & Comissões ({barbers.length})
        </button>

        <button
          onClick={() => navigateToSubTab('services')}
          className={`flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-center text-xs font-bold transition-all active:scale-95 ${
            subTab === 'services'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Scissors className="w-4 h-4" />
          Catálogo de Serviços ({services.length})
        </button>

        {currentUser?.permissions?.products !== false && (
          <button
            onClick={() => navigateToSubTab('products')}
            className={`flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-center text-xs font-bold transition-all active:scale-95 ${
              subTab === 'products'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Produtos & Estoque ({products.length})
          </button>
        )}

        {currentUser?.permissions?.usuarios !== false && (
          <button
            onClick={() => navigateToSubTab('users')}
            className={`flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-center text-xs font-bold transition-all active:scale-95 ${
              subTab === 'users' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Usuários & Permissões
          </button>
        )}

        <button
          onClick={() => navigateToSubTab('general')}
          className={`flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-center text-xs font-bold transition-all active:scale-95 ${
            subTab === 'general'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Perfil do Salão & Horários
        </button>

        <button
          onClick={() => navigateToSubTab('appearance')}
          className={`flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-center text-xs font-bold transition-all active:scale-95 ${
            subTab === 'appearance'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Palette className="w-4 h-4" />
          Aparência
        </button>

        <button
          onClick={() => navigateToSubTab('whatsapp')}
          className={`flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-center text-xs font-bold transition-all active:scale-95 ${
            subTab === 'whatsapp'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          WhatsApp Oficial
        </button>
      </div>

      {/* CONTEÚDO DA SUB-ABA */}
      <div ref={contentRef} className="pt-2">
        {subTab === 'team' && (
          <TeamView
            barbers={barbers}
            setBarbers={setBarbers}
            appointments={appointments}
          />
        )}

        {subTab === 'services' && (
          <ServicesView
            services={services}
            setServices={setServices}
          />
        )}

        {subTab === 'products' && currentUser?.permissions?.products !== false && (
          <ProductsView
            org={org}
            products={products}
            setProducts={setProducts}
            productSales={productSales}
            setProductSales={setProductSales}
          />
        )}

        {subTab === 'users' && currentUser?.permissions?.usuarios !== false && (
          <UsersPermissionsView barbers={barbers} currentUser={currentUser} />
        )}

        {subTab === 'general' && (
          <SettingsView
            section="general"
            org={org}
            setOrg={setOrg}
            onLoadDemo={onLoadDemo}
            onResetAll={onResetAll}
            appThemeMode={appThemeMode}
            setAppThemeMode={setAppThemeMode}
            appThemePreference={appThemePreference}
            followSystemTheme={followSystemTheme}
          />
        )}

        {subTab === 'appearance' && (
          <SettingsView
            section="appearance"
            org={org}
            setOrg={setOrg}
            onLoadDemo={onLoadDemo}
            onResetAll={onResetAll}
            appThemeMode={appThemeMode}
            setAppThemeMode={setAppThemeMode}
            appThemePreference={appThemePreference}
            followSystemTheme={followSystemTheme}
          />
        )}

        {subTab === 'whatsapp' && (
          <WhatsAppSettingsSection org={org} setOrg={setOrg} />
        )}
      </div>
    </div>
  );
};
