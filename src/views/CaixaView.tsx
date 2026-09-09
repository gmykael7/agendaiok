import { Modal } from "../components/common/Modal";
import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  DollarSign,
  ArrowUpRight,
  CreditCard,
  QrCode,
  Banknote,
  Users,
  Percent,
  History,
  Clock3,
  CalendarDays,
  BarChart3,
  ArrowRight,
  Boxes,
  PlusCircle,
  MinusCircle,
  X,
  Save,
  Sparkles,
} from 'lucide-react';
import { Appointment, Barber, ProductSale, Organization, CashMovement } from '../types';
import { BarberAvatar } from '../components/common/BarberAvatar';

interface CaixaViewProps {
  appointments: Appointment[];
  barbers: Barber[];
  productSales?: ProductSale[];
  onNavigateToProducts?: () => void;
  onNavigateToReports?: () => void;
  org: Organization;
  setOrg: React.Dispatch<React.SetStateAction<Organization>>;
}

const localDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getCommissionTotal = (appointments: Appointment[], barbers: Barber[]): number =>
  barbers.reduce((acc, barber) => {
    const gross = appointments
      .filter(item => item.barber_id === barber.id)
      .reduce((sum, item) => sum + Number(item.price || 0), 0);
    return acc + (gross * Number(barber.commission_rate || 0)) / 100;
  }, 0);

export const CaixaView: React.FC<CaixaViewProps> = ({ appointments, barbers, productSales = [], onNavigateToProducts, onNavigateToReports, org, setOrg }) => {
  const [todayKey, setTodayKey] = useState(() => localDateKey());
  const [movementModal, setMovementModal] = useState<'entry' | 'withdrawal' | null>(null);
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  // Mantém o caixa sincronizado com a virada do dia mesmo se o sistema ficar aberto.
  useEffect(() => {
    const updateDay = () => {
      const next = localDateKey();
      setTodayKey(current => (current === next ? current : next));
    };

    updateDay();
    const timer = window.setInterval(updateDay, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const completed = useMemo(
    () => appointments.filter(item => item.status === 'completed'),
    [appointments]
  );

  // O caixa corrente considera SOMENTE o dia atual. Na virada para 00:00 ele começa zerado.
  const todayCompleted = useMemo(
    () => completed.filter(item => (item.date || todayKey) === todayKey),
    [completed, todayKey]
  );

  const completedProductSales = useMemo(() => productSales.filter(item => item.status === 'completed'), [productSales]);
  const todayProductSales = useMemo(() => completedProductSales.filter(item => item.date === todayKey), [completedProductSales, todayKey]);
  const serviceRevenueToday = todayCompleted.reduce((acc, curr) => acc + Number(curr.price || 0), 0);
  const productRevenueToday = todayProductSales.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
  const totalFaturado = serviceRevenueToday + productRevenueToday;
  const totalPix = todayCompleted.filter(item => item.payment_method === 'pix').reduce((acc, curr) => acc + Number(curr.price || 0), 0)
    + todayProductSales.filter(item => item.payment_method === 'pix').reduce((acc, curr) => acc + Number(curr.total || 0), 0);
  const totalCartao = todayCompleted.filter(item => item.payment_method === 'credit' || item.payment_method === 'debit').reduce((acc, curr) => acc + Number(curr.price || 0), 0)
    + todayProductSales.filter(item => item.payment_method === 'credit' || item.payment_method === 'debit').reduce((acc, curr) => acc + Number(curr.total || 0), 0);
  const totalDinheiro = todayCompleted.filter(item => item.payment_method === 'cash' || !item.payment_method).reduce((acc, curr) => acc + Number(curr.price || 0), 0)
    + todayProductSales.filter(item => item.payment_method === 'cash' || !item.payment_method).reduce((acc, curr) => acc + Number(curr.total || 0), 0);

  const totalComissoes = getCommissionTotal(todayCompleted, barbers);
  const cashMovements = useMemo(() => (org.cash_movements || []).filter(item => item.date === todayKey), [org.cash_movements, todayKey]);
  const manualEntries = cashMovements.filter(item => item.type === 'entry').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const manualWithdrawals = cashMovements.filter(item => item.type === 'withdrawal').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const lucroLiquido = totalFaturado - totalComissoes;
  const saldoCaixa = totalDinheiro + manualEntries - manualWithdrawals;

  const saveCashMovement = () => {
    if (!movementModal) return;
    const amount = Number(String(movementAmount).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || !movementDescription.trim()) return;
    const now = new Date();
    const movement: CashMovement = {
      id: `cash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: movementModal,
      amount,
      description: movementDescription.trim(),
      date: todayKey,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      created_at: now.toISOString(),
    };
    setOrg(current => ({ ...current, cash_movements: [movement, ...(current.cash_movements || [])].slice(0, 500) }));
    setMovementAmount('');
    setMovementDescription('');
    setMovementModal(null);
  };

  // Os fechamentos anteriores permanecem disponíveis porque são reconstruídos a partir
  // dos atendimentos concluídos já persistidos no sistema/nuvem.
  const closures = useMemo(() => {
    const dates = new Set<string>();
    completed.forEach(item => { const key = item.date || todayKey; if (key !== todayKey) dates.add(key); });
    completedProductSales.forEach(item => { if (item.date && item.date !== todayKey) dates.add(item.date); });
    (org.cash_movements || []).forEach(item => { if (item.date && item.date !== todayKey) dates.add(item.date); });

    return Array.from(dates).map((date) => {
      const serviceItems = completed.filter(item => (item.date || todayKey) === date);
      const productItems = completedProductSales.filter(item => item.date === date);
      const serviceGross = serviceItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
      const productGross = productItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
      const gross = serviceGross + productGross;
      const commissions = getCommissionTotal(serviceItems, barbers);
      const pix = serviceItems.filter(item => item.payment_method === 'pix').reduce((sum, item) => sum + Number(item.price || 0), 0)
        + productItems.filter(item => item.payment_method === 'pix').reduce((sum, item) => sum + Number(item.total || 0), 0);
      const card = serviceItems.filter(item => item.payment_method === 'credit' || item.payment_method === 'debit').reduce((sum, item) => sum + Number(item.price || 0), 0)
        + productItems.filter(item => item.payment_method === 'credit' || item.payment_method === 'debit').reduce((sum, item) => sum + Number(item.total || 0), 0);
      const cash = serviceItems.filter(item => item.payment_method === 'cash' || !item.payment_method).reduce((sum, item) => sum + Number(item.price || 0), 0)
        + productItems.filter(item => item.payment_method === 'cash' || !item.payment_method).reduce((sum, item) => sum + Number(item.total || 0), 0);
      const movements = (org.cash_movements || []).filter(item => item.date === date);
      const entries = movements.filter(item => item.type === 'entry').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const withdrawals = movements.filter(item => item.type === 'withdrawal').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { date, serviceItems, productItems, gross, commissions, net: gross - commissions, pix, card, cash, entries, withdrawals, cashBalance: cash + entries - withdrawals };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [completed, completedProductSales, barbers, todayKey, org.cash_movements]);

  return (
    <div className="app-view space-y-6 animate-fadeIn">
      <div className="bg-[#121B2E] p-5 sm:p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-emerald-400" />
            Caixa do Dia
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Movimentação de {formatDate(todayKey)}. O fechamento diário é automático às 23h59 e o novo dia inicia zerado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 px-3 py-2 text-xs text-cyan-200">
            <Clock3 className="w-4 h-4" />
            Fechamento automático • 23h59
          </div>
          <button
            type="button"
            onClick={() => setMovementModal('entry')}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/10 hover:bg-emerald-400/15 border border-emerald-400/25 px-3.5 py-2 text-xs font-black text-emerald-300 transition-all active:scale-95 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Adicionar
          </button>
          <button
            type="button"
            onClick={() => setMovementModal('withdrawal')}
            className="inline-flex items-center gap-2 rounded-2xl bg-rose-400/10 hover:bg-rose-400/15 border border-rose-400/25 px-3.5 py-2 text-xs font-black text-rose-300 transition-all active:scale-95 shadow-sm"
          >
            <MinusCircle className="w-4 h-4" /> Retirar
          </button>
          {onNavigateToProducts && (
            <button
              type="button"
              onClick={onNavigateToProducts}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950/70 hover:bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-white transition-all active:scale-95"
            >
              <Boxes className="w-4 h-4 text-cyan-300" /> Produtos <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
          {onNavigateToReports && (
            <button
              type="button"
              onClick={onNavigateToReports}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950/70 hover:bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-white transition-all active:scale-95"
            >
              <BarChart3 className="w-4 h-4 text-cyan-300" /> Relatórios <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="stagger-item booking-card bg-[#121B2E] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Faturamento Bruto</p>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-4xl xl:text-5xl font-black text-emerald-400 font-mono mt-3 tracking-[-0.04em]">R$ {totalFaturado.toFixed(2)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{todayCompleted.length} serviços + {todayProductSales.length} vendas de produtos</p>
        </div>

        <div className="stagger-item booking-card bg-[#121B2E] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md" style={{ animationDelay: '40ms' }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Comissões a Pagar</p>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-4xl xl:text-5xl font-black text-amber-400 font-mono mt-3 tracking-[-0.04em]">R$ {totalComissoes.toFixed(2)}</p>
          <p className="text-[11px] text-slate-400 mt-1">Comissões referentes apenas ao dia atual</p>
        </div>

        <div className="stagger-item booking-card col-span-2 sm:col-span-1 bg-[#121B2E] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">Lucro Líquido</p>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-4xl xl:text-5xl font-black text-white font-mono mt-3 tracking-[-0.04em]">R$ {lucroLiquido.toFixed(2)}</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-semibold">Saldo líquido do salão hoje</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-3.5 sm:p-4 shadow-sm"><p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-emerald-300 font-black">Entradas</p><p className="text-base sm:text-2xl font-black text-white mt-1 font-mono">R$ {manualEntries.toFixed(2)}</p></div>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-3.5 sm:p-4 shadow-sm"><p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-rose-300 font-black">Retiradas</p><p className="text-base sm:text-2xl font-black text-white mt-1 font-mono">R$ {manualWithdrawals.toFixed(2)}</p></div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3.5 sm:p-4 shadow-sm"><p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-cyan-300 font-black">Saldo caixa</p><p className="text-base sm:text-2xl font-black text-white mt-1 font-mono">R$ {saldoCaixa.toFixed(2)}</p></div>
      </div>

      <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white">Recebimentos de Hoje</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-[#0B1120] border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0"><QrCode className="w-5 h-5" /></div>
            <div><p className="text-xs text-slate-400">Pix</p><p className="text-lg font-black text-white font-mono">R$ {totalPix.toFixed(2)}</p></div>
          </div>
          <div className="bg-[#0B1120] border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5" /></div>
            <div><p className="text-xs text-slate-400">Cartão</p><p className="text-lg font-black text-white font-mono">R$ {totalCartao.toFixed(2)}</p></div>
          </div>
          <div className="bg-[#0B1120] border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0"><Banknote className="w-5 h-5" /></div>
            <div><p className="text-xs text-slate-400">Dinheiro</p><p className="text-lg font-black text-white font-mono">R$ {totalDinheiro.toFixed(2)}</p></div>
          </div>
        </div>
      </div>

      <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          Comissões de Hoje
        </h3>
        <div className="divide-y divide-slate-800/60">
          {barbers.map(barber => {
            const barberAppointments = todayCompleted.filter(item => item.barber_id === barber.id);
            const gross = barberAppointments.reduce((acc, curr) => acc + Number(curr.price || 0), 0);
            const commission = (gross * Number(barber.commission_rate || 0)) / 100;

            return (
              <div key={barber.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <BarberAvatar name={barber.full_name} avatarUrl={barber.avatar_url} size="md" />
                  <div>
                    <h4 className="font-bold text-white text-sm">{barber.full_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{barberAppointments.length} atendimentos • <strong className="text-amber-400">{barber.commission_rate}%</strong></p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right"><p className="text-[11px] text-slate-400">Produção</p><p className="text-sm font-black text-white font-mono">R$ {gross.toFixed(2)}</p></div>
                  <div className="text-right"><p className="text-[11px] text-emerald-400 font-semibold">Comissão</p><p className="text-sm font-black text-emerald-400 font-mono">R$ {commission.toFixed(2)}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-[#121B2E] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-emerald-400" /> Histórico de Fechamentos</h3>
            <p className="text-xs text-slate-400 mt-1">Os dias anteriores permanecem registrados aqui para consulta.</p>
          </div>
        </div>

        {closures.length === 0 ? (
          <div className="rounded-2xl bg-[#0B1120] border border-slate-800 p-6 text-center text-xs text-slate-400">
            Nenhum fechamento anterior registrado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {closures.map(closure => (
              <div key={closure.date} className="booking-card rounded-2xl bg-[#0B1120] border border-slate-800 p-4 transition-all hover:border-slate-700 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-emerald-400 shrink-0"><CalendarDays className="w-5 h-5" /></div>
                    <div><p className="text-sm font-bold text-white">Fechamento • {formatDate(closure.date)}</p><p className="text-[11px] text-slate-400 mt-0.5">{closure.serviceItems.length} serviços • {closure.productItems.length} vendas de produtos</p></div>
                  </div>
                  <div className="grid grid-cols-3 sm:flex sm:items-center gap-3 sm:gap-6 text-right">
                    <div><p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Bruto</p><p className="text-xs font-black text-white font-mono">R$ {closure.gross.toFixed(2)}</p></div>
                    <div><p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Comissões</p><p className="text-xs font-black text-amber-400 font-mono">R$ {closure.commissions.toFixed(2)}</p></div>
                    <div><p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Líquido</p><p className="text-xs font-black text-emerald-400 font-mono">R$ {closure.net.toFixed(2)}</p></div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/70 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-400">
                  <span>Pix: <strong className="text-white font-mono">R$ {closure.pix.toFixed(2)}</strong></span>
                  <span>Cartão: <strong className="text-white font-mono">R$ {closure.card.toFixed(2)}</strong></span>
                  <span>Dinheiro: <strong className="text-white font-mono">R$ {closure.cash.toFixed(2)}</strong></span>
                  {(closure.entries > 0 || closure.withdrawals > 0) && <span>Mov. caixa: <strong className="text-white font-mono">+ R$ {closure.entries.toFixed(2)} / - R$ {closure.withdrawals.toFixed(2)}</strong></span>}
                  <span>Saldo caixa: <strong className="text-cyan-200 font-mono">R$ {closure.cashBalance.toFixed(2)}</strong></span>
                  <span className="text-cyan-300">Fechado automaticamente às 23h59</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {movementModal && (
        <Modal label="Movimentação de caixa" onClose={() => setMovementModal(null)} className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 app-mobile-modal" onClick={() => setMovementModal(null)}>
          <div className="modal-shell-fixed w-full sm:max-w-md max-h-[100dvh] sm:max-h-[88dvh] rounded-t-3xl sm:rounded-3xl border border-slate-700 bg-[#0b1426] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="modal-static-header sticky top-0 z-10 bg-[#0b1426]/98 backdrop-blur border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between">
              <div><h3 className="text-lg font-black text-white flex items-center gap-2">{movementModal === 'entry' ? <PlusCircle className="w-5 h-5 text-emerald-300" /> : <MinusCircle className="w-5 h-5 text-rose-300" />}{movementModal === 'entry' ? 'Adicionar ao caixa' : 'Retirar do caixa'}</h3><p className="text-xs text-slate-500 mt-1">Movimentação manual do caixa de hoje.</p></div>
              <button aria-label="Fechar janela" type="button" onClick={() => setMovementModal(null)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-scroll-body p-4 sm:p-5 space-y-4">
              <div><label htmlFor="caixa-field-1" className="block text-xs font-bold text-slate-300 mb-1.5">Valor (R$)</label><input id="caixa-field-1" inputMode="decimal" value={movementAmount} onChange={e => setMovementAmount(e.target.value)} placeholder="0,00" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg font-black text-white focus:outline-none focus:border-cyan-400/40 font-mono" /></div>
              <div><label htmlFor="caixa-field-2" className="block text-xs font-bold text-slate-300 mb-1.5">Motivo / descrição</label><input id="caixa-field-2" value={movementDescription} onChange={e => setMovementDescription(e.target.value)} placeholder={movementModal === 'entry' ? 'Ex: troco inicial, recebimento extra...' : 'Ex: compra de material, retirada do proprietário...'} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400/40" /></div>
              {cashMovements.length > 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-[10px] uppercase tracking-wide font-black text-slate-500 mb-2">Movimentações de hoje</p><div className="space-y-2 max-h-40 overflow-y-auto pr-1">{cashMovements.slice(0,8).map(item => <div key={item.id} className="flex items-center justify-between gap-3 text-xs"><div className="min-w-0"><p className="text-slate-200 truncate">{item.description}</p><p className="text-[10px] text-slate-600">{item.time}</p></div><span className={`font-black font-mono ${item.type === 'entry' ? 'text-emerald-300' : 'text-rose-300'}`}>{item.type === 'entry' ? '+' : '-'} R$ {Number(item.amount).toFixed(2)}</span></div>)}</div></div>}
            </div>
            <div className="modal-static-footer sticky bottom-0 z-10 border-t border-slate-800 bg-[#0b1426]/98 backdrop-blur p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2 justify-end">
              <button type="button" onClick={() => setMovementModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={saveCashMovement} disabled={!movementDescription.trim() || !(Number(String(movementAmount).replace(',', '.')) > 0)} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-2 disabled:opacity-40 hover:bg-emerald-400 shadow-sm active:scale-95"><Save className="w-4 h-4" /> Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
