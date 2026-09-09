import { Modal } from "../components/common/Modal";
import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MessageSquare,
  X,
  CalendarDays,
  WalletCards,
  TrendingUp,
  History,
  Clock3,
  Scissors,
  UserRound,
  Save,
  UserCheck,
  UserMinus,
  Star,
  Pencil,
  Trash2,
  AlertTriangle,
  UserX,
  Sparkles,
} from 'lucide-react';
import { Client, Appointment, Organization } from '../types';
import { clientIdentityKey, dedupeClients, normalizeClientPhone, upsertClient } from '../utils/clients';
import { buildClientWhatsAppUrl, WhatsAppAction } from '../utils/whatsapp';
import { getClientCrmStats } from '../utils/clientCrm';
import { WhatsAppActionsModal } from '../components/common/WhatsAppActionsModal';

interface ClientesViewProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  org: Organization;
  setOrg: React.Dispatch<React.SetStateAction<Organization>>;
}

type ClientFilter = 'all' | 'active' | 'inactive';

const formatMoney = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusMeta = (status: Appointment['status']) => {
  if (status === 'completed') return { label: 'Concluído', className: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25' };
  if (status === 'canceled') return { label: 'Cancelado', className: 'text-rose-300 bg-rose-400/10 border-rose-400/25' };
  if (status === 'no_show') return { label: 'Não compareceu', className: 'text-orange-300 bg-orange-400/10 border-orange-400/25' };
  if (status === 'in_progress') return { label: 'Em atendimento', className: 'text-blue-200 bg-blue-400/10 border-blue-400/25' };
  if (status === 'arrived') return { label: 'Chegou', className: 'text-cyan-200 bg-cyan-400/10 border-cyan-400/25' };
  if (status === 'confirmed') return { label: 'Confirmado', className: 'text-sky-200 bg-sky-400/10 border-sky-400/25' };
  return { label: 'Agendado', className: 'text-amber-200 bg-amber-300/10 border-amber-300/25' };
};

export const ClientesView: React.FC<ClientesViewProps> = ({
  clients,
  setClients,
  appointments,
  setAppointments,
  org,
  setOrg,
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [whatsAppClient, setWhatsAppClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [profileNotes, setProfileNotes] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const inactiveDays: 30 | 45 | 60 = [30, 45, 60].includes(Number(org.crm_inactive_days))
    ? (Number(org.crm_inactive_days) as 30 | 45 | 60)
    : 45;

  const allClients = useMemo(() => {
    const map = new Map<string, Client>();
    const archivedKeys = new Set(
      (clients || [])
        .filter((client) => client?.archived === true)
        .map((client) => clientIdentityKey(client))
        .filter(Boolean),
    );

    dedupeClients(clients)
      .filter((client) => client.archived !== true)
      .forEach((client) => {
        const key = clientIdentityKey(client);
        if (key) map.set(key, { ...client });
      });

    appointments.forEach((appointment) => {
      const phoneKey = normalizeClientPhone(appointment.client_phone);
      const key = phoneKey ? `phone:${phoneKey}` : `name:${appointment.client_name.toLowerCase().trim()}`;
      if (archivedKeys.has(key)) return;
      if (!map.has(key)) {
        map.set(key, {
          id: `cli-${phoneKey || appointment.id}`,
          org_id: appointment.org_id,
          name: appointment.client_name,
          phone: appointment.client_phone || 'Não informado',
          total_visits: 0,
          total_spent: 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [clients, appointments]);

  const clientsWithStats = useMemo(() => allClients.map((client) => ({
    client,
    stats: getClientCrmStats(client, appointments),
  })), [allClients, appointments]);

  const inactiveClients = useMemo(() => clientsWithStats.filter(({ stats }) =>
    !stats.upcomingAppointment && stats.daysSinceLastVisit !== null && stats.daysSinceLastVisit >= inactiveDays,
  ), [clientsWithStats, inactiveDays]);

  const activeClients = useMemo(() => clientsWithStats.filter(({ stats }) =>
    Boolean(stats.upcomingAppointment) || (stats.daysSinceLastVisit !== null && stats.daysSinceLastVisit < inactiveDays),
  ), [clientsWithStats, inactiveDays]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return clientsWithStats.filter(({ client, stats }) => {
      const matchesSearch = !normalizedSearch ||
        client.name.toLowerCase().includes(normalizedSearch) ||
        client.phone.toLowerCase().includes(normalizedSearch) ||
        stats.favoriteService.toLowerCase().includes(normalizedSearch) ||
        stats.favoriteBarber.toLowerCase().includes(normalizedSearch);

      const isInactive = !stats.upcomingAppointment && stats.daysSinceLastVisit !== null && stats.daysSinceLastVisit >= inactiveDays;
      const isActive = Boolean(stats.upcomingAppointment) || (stats.daysSinceLastVisit !== null && stats.daysSinceLastVisit < inactiveDays);
      if (filter === 'inactive' && !isInactive) return false;
      if (filter === 'active' && !isActive) return false;
      return matchesSearch;
    });
  }, [clientsWithStats, search, filter, inactiveDays]);

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setClients((prev) => upsertClient(prev, {
      name: name.trim(),
      phone: phone.trim() || 'Não informado',
      visitDelta: 0,
      spentDelta: 0,
      lastVisit: 'Novo cliente',
    }));
    setName('');
    setPhone('');
    setShowModal(false);
  };

  const latestAppointmentForClient = (client: Client) => getClientCrmStats(client, appointments).appointments[0];

  const getClientWhatsApp = (client: Client, action: WhatsAppAction) =>
    buildClientWhatsAppUrl(org, client, action, latestAppointmentForClient(client));

  const openProfile = (client: Client) => {
    setSelectedClient(client);
    setProfileNotes(client.notes || '');
    setEditingName(client.name);
    setEditingPhone(client.phone || '');
    setShowNameEditor(false);
    setShowDeleteConfirm(false);
  };

  const saveNotes = () => {
    if (!selectedClient) return;
    const selectedPhone = normalizeClientPhone(selectedClient.phone);
    const cleanNotes = profileNotes.trim();

    setClients((prev) => {
      const next = dedupeClients(prev);
      const index = next.findIndex((client) => {
        const clientPhone = normalizeClientPhone(client.phone);
        return selectedPhone ? clientPhone === selectedPhone : client.name.toLowerCase() === selectedClient.name.toLowerCase();
      });

      if (index >= 0) {
        next[index] = { ...next[index], notes: cleanNotes };
        return next;
      }

      return [{
        ...selectedClient,
        notes: cleanNotes,
      }, ...next];
    });

    setSelectedClient((current) => current ? { ...current, notes: cleanNotes } : current);
  };

  const saveClientName = () => {
    if (!selectedClient) return;
    const cleanName = editingName.trim();
    const cleanPhone = editingPhone.trim() || 'Não informado';
    if (!cleanName) return;

    const oldName = selectedClient.name;
    const oldPhone = normalizeClientPhone(selectedClient.phone);

    setClients((prev) => {
      const next = dedupeClients(prev);
      const index = next.findIndex((client) => {
        const clientPhone = normalizeClientPhone(client.phone);
        return oldPhone ? clientPhone === oldPhone : client.name.trim().toLowerCase() === oldName.trim().toLowerCase();
      });
      const updated = { ...selectedClient, name: cleanName, phone: cleanPhone, archived: false, archived_at: undefined };
      if (index >= 0) { next[index] = { ...next[index], ...updated }; return next; }
      return [updated, ...next];
    });

    setAppointments((prev) => prev.map((appointment) => {
      const appointmentPhone = normalizeClientPhone(appointment.client_phone);
      const sameClient = oldPhone ? appointmentPhone === oldPhone : String(appointment.client_name || '').trim().toLowerCase() === oldName.trim().toLowerCase();
      return sameClient ? { ...appointment, client_name: cleanName, client_phone: cleanPhone } : appointment;
    }));

    setSelectedClient((current) => current ? { ...current, name: cleanName, phone: cleanPhone } : current);
    setShowNameEditor(false);
  };

  const deleteClient = () => {
    if (!selectedClient) return;
    const selectedPhone = normalizeClientPhone(selectedClient.phone);
    const selectedName = selectedClient.name.trim().toLowerCase();
    const archivedAt = new Date().toISOString();

    setClients((prev) => {
      const next = dedupeClients(prev);
      const index = next.findIndex((client) => {
        const clientPhone = normalizeClientPhone(client.phone);
        return selectedPhone
          ? clientPhone === selectedPhone
          : client.name.trim().toLowerCase() === selectedName;
      });

      if (index >= 0) {
        next[index] = { ...next[index], archived: true, archived_at: archivedAt };
        return next;
      }

      return [{ ...selectedClient, archived: true, archived_at: archivedAt }, ...next];
    });

    setWhatsAppClient((current) => current?.id === selectedClient.id ? null : current);
    setShowDeleteConfirm(false);
    setSelectedClient(null);
  };

  const updateInactiveDays = (value: number) => {
    const nextValue: 30 | 45 | 60 = value === 30 || value === 60 ? value : 45;
    setOrg((current) => ({ ...current, crm_inactive_days: nextValue }));
  };

  const selectedStats = selectedClient ? getClientCrmStats(selectedClient, appointments) : null;
  const selectedInactive = Boolean(
    selectedStats &&
    !selectedStats.upcomingAppointment &&
    selectedStats.daysSinceLastVisit !== null &&
    selectedStats.daysSinceLastVisit >= inactiveDays,
  );

  return (
    <div className="app-view space-y-6 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121B2E] p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            Clientes & CRM
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Relacionamento, histórico, preferências e oportunidades para trazer clientes de volta.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Novo cliente</span>
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="stagger-item booking-card rounded-2xl border border-slate-800 bg-[#121B2E] p-4 sm:p-5 shadow-md">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-bold">Base total</p>
          <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">{allClients.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">clientes identificados</p>
        </div>
        <div className="stagger-item booking-card rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 sm:p-5 shadow-md" style={{ animationDelay: '30ms' }}>
          <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300 font-bold">Relacionamento ativo</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1 font-mono">{activeClients.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">recentes ou já agendados</p>
        </div>
        <button
          type="button"
          onClick={() => setFilter('inactive')}
          style={{ animationDelay: '60ms' }}
          className="stagger-item booking-card text-left rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 sm:p-5 hover:bg-amber-300/10 transition-all shadow-md active:scale-98"
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200 font-bold">Para reativar</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-200 mt-1 font-mono">{inactiveClients.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">sem voltar há {inactiveDays}+ dias</p>
        </button>
        <div className="stagger-item booking-card rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 sm:p-5 shadow-md" style={{ animationDelay: '90ms' }}>
          <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-200 font-bold">Faturamento histórico</p>
          <p className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
            {formatMoney(clientsWithStats.reduce((sum, item) => sum + item.stats.totalSpent, 0))}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">somente atendimentos concluídos</p>
        </div>
      </div>

      {inactiveClients.length > 0 && (
        <section className="rounded-3xl border border-amber-300/20 bg-gradient-to-r from-amber-300/5 to-transparent p-4 sm:p-5 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200 font-black">Oportunidades de retorno</p>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">Clientes que podem receber uma mensagem</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Considerar inativo após</span>
              <select
                value={inactiveDays}
                onChange={(event) => updateInactiveDays(Number(event.target.value))}
                className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value={30}>30 dias</option>
                <option value={45}>45 dias</option>
                <option value={60}>60 dias</option>
              </select>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {inactiveClients.slice(0, 3).map(({ client, stats }) => (
              <div key={client.id} className="booking-card rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate text-sm">{client.name}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Última visita: {stats.lastVisitLabel}</p>
                  </div>
                  <span className="text-[10px] font-black text-amber-200 bg-amber-300/10 border border-amber-300/20 rounded-full px-2.5 py-0.5 shrink-0 font-mono">
                    {stats.daysSinceLastVisit} dias
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWhatsAppClient(client)}
                  className="mt-3 w-full rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 flex items-center justify-center gap-2 hover:bg-emerald-400/15 transition-all active:scale-95"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Chamar no WhatsApp
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente, serviço ou profissional..."
            aria-label="Buscar cliente, serviço ou profissional"
            className="w-full bg-[#121B2E] border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {([
            ['all', 'Todos', allClients.length],
            ['active', 'Ativos', activeClients.length],
            ['inactive', 'Inativos', inactiveClients.length],
          ] as const).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${filter === value ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-sm' : 'border-slate-800 bg-[#121B2E] text-slate-400 hover:text-white'}`}
            >
              {label} <span className="ml-1 opacity-70 font-mono">({count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#121B2E] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="p-12 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto border border-slate-700/60">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-base">Nenhum cliente encontrado</h4>
            <p className="text-xs text-slate-400">Ajuste a busca ou o filtro selecionado.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map(({ client, stats }, index) => {
              const isInactive = !stats.upcomingAppointment && stats.daysSinceLastVisit !== null && stats.daysSinceLastVisit >= inactiveDays;
              return (
                <div key={client.id} style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }} className="stagger-item p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-slate-800/25 transition-colors">
                  <button type="button" onClick={() => openProfile(client)} className="flex items-center gap-4 min-w-0 text-left group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-bold text-white text-base leading-snug truncate group-hover:text-emerald-400 transition-colors">{client.name}</h4>
                        {isInactive ? (
                          <span className="shrink-0 text-[9px] uppercase tracking-wide font-black text-amber-200 border border-amber-300/20 bg-amber-300/10 rounded-full px-2 py-0.5">Reativar</span>
                        ) : stats.totalVisits > 0 ? (
                          <span className="shrink-0 text-[9px] uppercase tracking-wide font-black text-emerald-300 border border-emerald-400/20 bg-emerald-400/10 rounded-full px-2 py-0.5">Ativo</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                        <Phone className="w-3 h-3 text-slate-500" /> {client.phone || 'Sem telefone'}
                      </p>
                      <p className="text-[11px] text-cyan-300/80 mt-1 truncate">Preferência: {stats.favoriteService}</p>
                    </div>
                  </button>

                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:flex xl:items-center gap-3 xl:gap-7 border-t xl:border-t-0 border-slate-800/60 pt-3 xl:pt-0">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Atendimentos</p>
                      <p className="text-sm font-black text-white font-mono mt-0.5">{stats.totalVisits}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Total gasto</p>
                      <p className="text-sm font-black text-emerald-400 font-mono mt-0.5">{formatMoney(stats.totalSpent)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Última visita</p>
                      <p className="text-xs font-bold text-slate-200 mt-0.5">{stats.lastVisitLabel}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2 col-span-2 sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => openProfile(client)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors active:scale-95"
                      >
                        Ver perfil
                      </button>
                      {client.phone && client.phone !== 'Não informado' && (
                        <button
                          type="button"
                          onClick={() => setWhatsAppClient(client)}
                          className="p-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl transition-colors active:scale-95"
                          title="Ações pelo WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <WhatsAppActionsModal
        open={Boolean(whatsAppClient)}
        recipientName={whatsAppClient?.name || 'cliente'}
        onClose={() => setWhatsAppClient(null)}
        actions={whatsAppClient ? [
          { action: 'confirm', label: 'Confirmar horário', href: getClientWhatsApp(whatsAppClient, 'confirm') },
          { action: 'reminder', label: 'Lembrar atendimento', href: getClientWhatsApp(whatsAppClient, 'reminder') },
          { action: 'thanks', label: 'Agradecer atendimento', href: getClientWhatsApp(whatsAppClient, 'thanks') },
          { action: 'inactive', label: 'Chamar cliente inativo', href: getClientWhatsApp(whatsAppClient, 'inactive') },
        ] : []}
      />

      {selectedClient && showNameEditor && (
        <Modal label="Editar cliente" onClose={() => setShowNameEditor(false)} className="fixed inset-0 z-[230] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setShowNameEditor(false)}>
          <div className="modal-shell-fixed w-full max-w-md max-h-[90dvh] rounded-3xl border border-slate-700 bg-[#0b1426] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="modal-static-header flex items-center justify-between gap-3 border-b border-slate-800 p-4 sm:p-5 bg-[#0b1426]">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2"><Pencil className="w-4 h-4 text-emerald-400" /> Editar cliente</h3>
                <p className="text-xs text-slate-400 mt-1">Edite nome e telefone sem perder histórico, atendimentos ou valores.</p>
              </div>
              <button aria-label="Fechar janela" type="button" onClick={() => setShowNameEditor(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-scroll-body p-4 sm:p-5 space-y-3.5">
              <div>
                <label htmlFor="clientes-field-1" className="block text-xs font-semibold text-slate-300 mb-1.5">Nome do cliente</label>
                <input id="clientes-field-1"
                  autoFocus
                  type="text"
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') saveClientName(); }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="clientes-field-2" className="block text-xs font-semibold text-slate-300 mb-1.5">WhatsApp / Telefone</label>
                <input id="clientes-field-2" type="tel" value={editingPhone} onChange={(event) => setEditingPhone(event.target.value)} placeholder="(84) 99999-0000" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="modal-static-footer flex justify-end gap-2 border-t border-slate-800 bg-[#0b1426] p-4 sm:p-5">
              <button type="button" onClick={() => setShowNameEditor(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={saveClientName} disabled={!editingName.trim()} className="px-5 py-2 bg-emerald-500 text-slate-950 text-xs font-black disabled:opacity-40 flex items-center gap-2 hover:bg-emerald-400 rounded-xl shadow-sm active:scale-95"><Save className="w-3.5 h-3.5" /> Salvar cliente</button>
            </div>
          </div>
        </Modal>
      )}

      {selectedClient && showDeleteConfirm && (
        <Modal label="Excluir cliente" onClose={() => setShowDeleteConfirm(false)} className="fixed inset-0 z-[240] app-mobile-modal bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-shell-fixed w-full max-w-md rounded-3xl border border-rose-500/25 bg-[#0b1426] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="modal-scroll-body p-5 sm:p-6 space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-400/10 border border-rose-400/20 flex items-center justify-center text-rose-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white">Excluir {selectedClient.name}?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                O cliente será removido da lista e do CRM. <strong className="text-slate-200">Os agendamentos, atendimentos e registros financeiros serão preservados</strong> para não alterar o histórico do estabelecimento.
              </p>
              <p className="text-xs text-slate-500">Se esse telefone fizer um novo agendamento no futuro, o cadastro poderá ser criado novamente automaticamente.</p>
            </div>
            <div className="modal-static-footer flex justify-end gap-2 border-t border-slate-800 bg-[#0b1426] p-4 sm:p-5">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={deleteClient} className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-black flex items-center justify-center gap-2 rounded-xl shadow-sm active:scale-95"><Trash2 className="w-3.5 h-3.5" /> Excluir cliente</button>
            </div>
          </div>
        </Modal>
      )}

      {selectedClient && selectedStats && (
        <Modal label="Detalhes do cliente" onClose={() => setSelectedClient(null)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" onClick={() => setSelectedClient(null)}>
          <div className="modal-shell-fixed w-full max-w-4xl max-h-[88dvh] rounded-3xl border border-slate-700 bg-[#0b1426] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="modal-static-header bg-[#0b1426]/95 backdrop-blur-xl border-b border-slate-800 p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-lg shrink-0">
                  {selectedClient.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-black text-white truncate">{selectedClient.name}</h3>
                    {selectedStats.totalVisits === 0 && !selectedStats.upcomingAppointment ? (
                      <span className="text-[9px] uppercase tracking-wider font-black text-cyan-200 border border-cyan-400/25 bg-cyan-400/10 rounded-full px-2 py-0.5">Novo cliente</span>
                    ) : selectedInactive ? (
                      <span className="text-[9px] uppercase tracking-wider font-black text-amber-200 border border-amber-300/25 bg-amber-300/10 rounded-full px-2 py-0.5">Cliente inativo</span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-wider font-black text-emerald-300 border border-emerald-400/25 bg-emerald-400/10 rounded-full px-2 py-0.5">Relacionamento ativo</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-emerald-400" /> {selectedClient.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditingName(selectedClient.name); setEditingPhone(selectedClient.phone || ''); setShowNameEditor(true); }}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/60 transition-colors"
                  title="Editar cliente"
                  aria-label="Editar cliente"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-xl text-rose-300 hover:text-white hover:bg-rose-950/30 border border-rose-800/40 transition-colors"
                  title="Excluir cliente"
                  aria-label="Excluir cliente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button aria-label="Fechar janela" onClick={() => setSelectedClient(null)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="modal-scroll-body p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 shadow-sm">
                  <CalendarDays className="w-4 h-4 text-cyan-300" />
                  <p className="text-2xl font-black text-white mt-2 font-mono">{selectedStats.totalVisits}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 font-semibold">Atendimentos concluídos</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 shadow-sm">
                  <WalletCards className="w-4 h-4 text-emerald-400" />
                  <p className="text-xl font-black text-emerald-400 mt-2 font-mono">{formatMoney(selectedStats.totalSpent)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 font-semibold">Total gasto</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 shadow-sm">
                  <TrendingUp className="w-4 h-4 text-blue-300" />
                  <p className="text-xl font-black text-white mt-2 font-mono">{formatMoney(selectedStats.averageTicket)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 font-semibold">Ticket médio</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 shadow-sm">
                  <Clock3 className="w-4 h-4 text-amber-300" />
                  <p className="text-base font-black text-white mt-2">{selectedStats.lastVisitLabel}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 font-semibold">Última visita</p>
                </div>
                <div className="rounded-2xl border border-orange-400/15 bg-orange-400/5 p-4 shadow-sm">
                  <UserX className="w-4 h-4 text-orange-300" />
                  <p className="text-2xl font-black text-orange-300 mt-2 font-mono">{selectedStats.noShowCount}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 font-semibold">Não compareceu</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 flex items-start gap-3 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0"><Scissors className="w-4 h-4 text-cyan-200" /></div>
                  <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Serviço preferido</p><p className="text-sm font-bold text-white mt-1">{selectedStats.favoriteService}</p></div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 flex items-start gap-3 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center shrink-0"><Star className="w-4 h-4 text-violet-200" /></div>
                  <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Profissional mais procurado</p><p className="text-sm font-bold text-white mt-1">{selectedStats.favoriteBarber}</p></div>
                </div>
              </div>

              {selectedStats.upcomingAppointment && (
                <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-4 sm:p-5 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200 font-black">Próximo atendimento</p>
                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-white">{selectedStats.upcomingAppointment.service_name}</p>
                      <p className="text-xs text-slate-400 mt-1">com {selectedStats.upcomingAppointment.barber_name}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-black text-cyan-200 font-mono">{selectedStats.upcomingAppointment.date ? new Date(`${selectedStats.upcomingAppointment.date}T12:00:00`).toLocaleDateString('pt-BR') : ''}</p>
                      <p className="text-xl font-black text-white font-mono">{selectedStats.upcomingAppointment.start_time}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4">
                <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div><p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Observações internas</p><p className="text-xs text-slate-400 mt-1">Preferências, detalhes ou lembretes da equipe.</p></div>
                  </div>
                  <textarea
                    value={profileNotes}
                    onChange={(event) => setProfileNotes(event.target.value)}
                    rows={7}
                    placeholder="Ex: prefere máquina 1 nas laterais, costuma vir às sextas..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-y"
                  />
                  <button type="button" onClick={saveNotes} className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2 text-xs font-bold text-emerald-400 flex items-center gap-2 hover:bg-emerald-500/15 transition-all active:scale-95"><Save className="w-3.5 h-3.5" /> Salvar observação</button>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 min-w-0 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div><p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Histórico do cliente</p><p className="text-xs text-slate-400 mt-1">Últimos agendamentos e atendimentos.</p></div>
                    <History className="w-4 h-4 text-slate-500" />
                  </div>
                  {selectedStats.appointments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">Ainda não existem atendimentos para este cliente.</div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {selectedStats.appointments.slice(0, 12).map((appointment) => {
                        const meta = statusMeta(appointment.status);
                        return (
                          <div key={appointment.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{appointment.service_name}</p>
                              <p className="text-[11px] text-slate-400 mt-1 truncate">{appointment.barber_name} • {appointment.date ? new Date(`${appointment.date}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data'} às {appointment.start_time}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${meta.className}`}>{meta.label}</span>
                              <p className="text-xs font-bold text-emerald-400 mt-1 font-mono">{formatMoney(appointment.price || 0)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => setWhatsAppClient(selectedClient)} className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-3 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"><MessageSquare className="w-4 h-4" /> Ações no WhatsApp</button>
                {selectedStats.totalVisits === 0 && !selectedStats.upcomingAppointment ? (
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-xs text-cyan-200 flex items-center gap-2"><UserRound className="w-4 h-4" /> Cliente cadastrado, ainda sem atendimento concluído.</div>
                ) : selectedInactive ? (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs text-amber-100 flex items-center gap-2"><UserMinus className="w-4 h-4" /> Há {selectedStats.daysSinceLastVisit} dias sem atendimento concluído.</div>
                ) : (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Cliente dentro da janela ativa de relacionamento.</div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal label="Cadastrar cliente" onClose={() => setShowModal(false)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="modal-shell-fixed bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl animate-fadeIn max-h-[90dvh]">
            <div className="modal-static-header flex justify-between items-center border-b border-slate-800 p-4 sm:p-5 bg-slate-900">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2"><UserRound className="w-5 h-5 text-emerald-400" /> Novo cliente</h3>
              <button aria-label="Fechar janela" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddClient} className="flex min-h-0 flex-1 flex-col">
              <div className="modal-scroll-body p-4 sm:p-5 space-y-3.5">
                <div>
                  <label htmlFor="clientes-field-3" className="block text-xs font-semibold text-slate-300 mb-1">Nome completo *</label>
                  <input id="clientes-field-3" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Gabriel Moreira" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="clientes-field-4" className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp / Telefone</label>
                  <input id="clientes-field-4" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(84) 99999-0000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>
              <div className="modal-static-footer flex justify-end gap-2 p-4 sm:p-5 border-t border-slate-800 bg-slate-900">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95">Cadastrar cliente</button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
