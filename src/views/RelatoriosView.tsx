import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  Clock3,
  Percent,
  Scissors,
  TrendingUp,
  UserRoundCheck,
  Users,
  UserX,
  WalletCards,
} from 'lucide-react';
import { Appointment, Barber, ProductSale } from '../types';
import { normalizeClientPhone } from '../utils/clients';

interface RelatoriosViewProps {
  appointments: Appointment[];
  barbers: Barber[];
  productSales?: ProductSale[];
}

type PeriodKey = '7d' | '30d' | 'month' | 'previous_month';

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
};

const dateFromKey = (key: string): Date => new Date(`${key}T12:00:00`);

const formatShortDate = (key: string): string =>
  dateFromKey(key).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const formatMoney = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dateKeyOfAppointment = (appointment: Appointment): string => appointment.date || '';

const clientKey = (appointment: Appointment): string => {
  const phone = normalizeClientPhone(appointment.client_phone);
  if (phone) return `phone:${phone}`;
  return `name:${String(appointment.client_name || '').trim().toLowerCase()}`;
};

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({ appointments, barbers, productSales = [] }) => {
  const [period, setPeriod] = useState<PeriodKey>('30d');

  const periodMeta = useMemo(() => {
    const today = new Date();
    const todayNoon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
    let start = todayNoon;
    let end = todayNoon;
    let label = 'Últimos 30 dias';

    if (period === '7d') {
      start = addDays(todayNoon, -6);
      label = 'Últimos 7 dias';
    } else if (period === '30d') {
      start = addDays(todayNoon, -29);
      label = 'Últimos 30 dias';
    } else if (period === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0);
      label = 'Este mês';
    } else {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12, 0, 0);
      end = new Date(today.getFullYear(), today.getMonth(), 0, 12, 0, 0);
      label = 'Mês anterior';
    }

    return {
      startKey: toDateKey(start),
      endKey: toDateKey(end),
      label,
      rangeLabel: `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
    };
  }, [period]);

  const metrics = useMemo(() => {
    const inRange = (appointment: Appointment) => {
      const date = dateKeyOfAppointment(appointment);
      return Boolean(date && date >= periodMeta.startKey && date <= periodMeta.endKey);
    };

    const periodAppointments = appointments.filter(inRange);
    const completed = periodAppointments.filter((appointment) => appointment.status === 'completed');
    const noShows = periodAppointments.filter((appointment) => appointment.status === 'no_show');
    const canceled = periodAppointments.filter((appointment) => appointment.status === 'canceled');
    const operational = periodAppointments.filter((appointment) => appointment.status !== 'canceled');
    const completedProductSales = productSales.filter((sale) => sale.status === 'completed' && sale.date >= periodMeta.startKey && sale.date <= periodMeta.endKey);

    const serviceRevenue = completed.reduce((sum, appointment) => sum + Math.max(0, Number(appointment.price || 0)), 0);
    const productRevenue = completedProductSales.reduce((sum, sale) => sum + Math.max(0, Number(sale.total || 0)), 0);
    const revenue = serviceRevenue + productRevenue;
    const operationCount = completed.length + completedProductSales.length;
    const averageTicket = operationCount ? revenue / operationCount : 0;

    const barberMap = new Map(barbers.map((barber) => [barber.id, barber]));
    const totalCommission = completed.reduce((sum, appointment) => {
      const rate = Number(barberMap.get(appointment.barber_id)?.commission_rate || 0);
      return sum + (Math.max(0, Number(appointment.price || 0)) * rate) / 100;
    }, 0);

    const dailyMap = new Map<string, { revenue: number; count: number }>();
    for (let cursor = dateFromKey(periodMeta.startKey); toDateKey(cursor) <= periodMeta.endKey; cursor = addDays(cursor, 1)) {
      dailyMap.set(toDateKey(cursor), { revenue: 0, count: 0 });
    }
    completed.forEach((appointment) => {
      const key = dateKeyOfAppointment(appointment);
      const current = dailyMap.get(key) || { revenue: 0, count: 0 };
      current.revenue += Math.max(0, Number(appointment.price || 0));
      current.count += 1;
      dailyMap.set(key, current);
    });
    completedProductSales.forEach((sale) => {
      const current = dailyMap.get(sale.date) || { revenue: 0, count: 0 };
      current.revenue += Math.max(0, Number(sale.total || 0));
      current.count += 1;
      dailyMap.set(sale.date, current);
    });
    const daily = [...dailyMap.entries()].map(([date, values]) => ({ date, ...values }));

    const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
    completed.forEach((appointment) => {
      if (appointment.services?.length) {
        appointment.services.forEach((service) => {
          const key = service.id || service.name;
          const current = serviceMap.get(key) || { name: service.name, count: 0, revenue: 0 };
          current.count += 1;
          current.revenue += Math.max(0, Number(service.price || 0));
          serviceMap.set(key, current);
        });
      } else {
        const name = appointment.service_name || 'Atendimento';
        const current = serviceMap.get(name) || { name, count: 0, revenue: 0 };
        current.count += 1;
        current.revenue += Math.max(0, Number(appointment.price || 0));
        serviceMap.set(name, current);
      }
    });
    const services = [...serviceMap.values()].sort((a, b) => b.count - a.count || b.revenue - a.revenue);

    const barberStats = barbers
      .map((barber) => {
        const items = completed.filter((appointment) => appointment.barber_id === barber.id);
        const gross = items.reduce((sum, appointment) => sum + Math.max(0, Number(appointment.price || 0)), 0);
        const commission = (gross * Math.max(0, Number(barber.commission_rate || 0))) / 100;
        return { barber, count: items.length, gross, commission };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.gross - a.gross || b.count - a.count);

    const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weekdayCounts = weekdayNames.map((name) => ({ name, count: 0 }));
    operational.forEach((appointment) => {
      if (!appointment.date) return;
      const day = dateFromKey(appointment.date).getDay();
      weekdayCounts[day].count += 1;
    });

    const hourMap = new Map<string, number>();
    operational.forEach((appointment) => {
      const hour = String(appointment.start_time || '').slice(0, 2);
      if (!hour) return;
      const label = `${hour}:00`;
      hourMap.set(label, (hourMap.get(label) || 0) + 1);
    });
    const hours = [...hourMap.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count || a.hour.localeCompare(b.hour));

    const firstCompletedByClient = new Map<string, string>();
    appointments
      .filter((appointment) => appointment.status === 'completed' && appointment.date)
      .forEach((appointment) => {
        const key = clientKey(appointment);
        const date = appointment.date!;
        const current = firstCompletedByClient.get(key);
        if (!current || date < current) firstCompletedByClient.set(key, date);
      });

    const periodClientKeys = [...new Set(completed.map(clientKey).filter(Boolean))];
    const newClients = periodClientKeys.filter((key) => {
      const first = firstCompletedByClient.get(key);
      return Boolean(first && first >= periodMeta.startKey && first <= periodMeta.endKey);
    }).length;
    const returningClients = Math.max(0, periodClientKeys.length - newClients);

    const payment = {
      pix: completed.filter((item) => item.payment_method === 'pix').reduce((sum, item) => sum + Number(item.price || 0), 0) + completedProductSales.filter((item) => item.payment_method === 'pix').reduce((sum, item) => sum + Number(item.total || 0), 0),
      card: completed.filter((item) => item.payment_method === 'credit' || item.payment_method === 'debit').reduce((sum, item) => sum + Number(item.price || 0), 0) + completedProductSales.filter((item) => item.payment_method === 'credit' || item.payment_method === 'debit').reduce((sum, item) => sum + Number(item.total || 0), 0),
      cash: completed.filter((item) => item.payment_method === 'cash' || !item.payment_method).reduce((sum, item) => sum + Number(item.price || 0), 0) + completedProductSales.filter((item) => item.payment_method === 'cash' || !item.payment_method).reduce((sum, item) => sum + Number(item.total || 0), 0),
    };

    return {
      completed,
      completedProductSales,
      productRevenue,
      noShows,
      canceled,
      revenue,
      averageTicket,
      totalCommission,
      net: revenue - totalCommission,
      daily,
      services,
      barberStats,
      weekdayCounts,
      hours,
      newClients,
      returningClients,
      uniqueClients: periodClientKeys.length,
      payment,
    };
  }, [appointments, barbers, productSales, periodMeta]);

  const maxDailyRevenue = Math.max(1, ...metrics.daily.map((item) => item.revenue));
  const maxServiceCount = Math.max(1, ...metrics.services.map((item) => item.count));
  const maxBarberGross = Math.max(1, ...metrics.barberStats.map((item) => item.gross));
  const maxWeekday = Math.max(1, ...metrics.weekdayCounts.map((item) => item.count));

  return (
    <div className="app-view space-y-5 sm:space-y-6 animate-fadeIn">
      <div className="rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-cyan-300" /> Relatórios e Desempenho
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Faturamento, equipe, serviços, demanda e comportamento dos clientes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['7d', '7 dias'],
            ['30d', '30 dias'],
            ['month', 'Este mês'],
            ['previous_month', 'Mês anterior'],
          ] as [PeriodKey, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriod(id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${period === id ? 'bg-cyan-400/15 border-cyan-400/30 text-cyan-200' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
        <CalendarRange className="w-4 h-4 text-cyan-300" />
        <strong className="text-slate-200">{periodMeta.label}</strong> • {periodMeta.rangeLabel}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#121B2E] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Faturamento</p><CircleDollarSign className="w-4 h-4 text-emerald-400" /></div>
          <p className="mt-3 text-2xl sm:text-3xl xl:text-4xl font-black tracking-[-0.04em] text-emerald-400 font-mono">{formatMoney(metrics.revenue)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{metrics.completed.length} serviços • {metrics.completedProductSales.length} vendas de produtos</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#121B2E] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Ticket médio</p><TrendingUp className="w-4 h-4 text-cyan-300" /></div>
          <p className="mt-3 text-2xl sm:text-3xl xl:text-4xl font-black tracking-[-0.04em] text-white font-mono">{formatMoney(metrics.averageTicket)}</p>
          <p className="text-[11px] text-slate-400 mt-1">Média por atendimento ou venda</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#121B2E] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Comissões</p><Percent className="w-4 h-4 text-amber-300" /></div>
          <p className="mt-3 text-2xl sm:text-3xl xl:text-4xl font-black tracking-[-0.04em] text-amber-300 font-mono">{formatMoney(metrics.totalCommission)}</p>
          <p className="text-[11px] text-slate-400 mt-1">Líquido estimado: <strong className="text-white">{formatMoney(metrics.net)}</strong></p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#121B2E] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Não compareceram</p><UserX className="w-4 h-4 text-orange-300" /></div>
          <p className="mt-3 text-2xl sm:text-3xl xl:text-4xl font-black tracking-[-0.04em] text-orange-300 font-mono">{metrics.noShows.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">{metrics.canceled.length} cancelamentos no período</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <section className="xl:col-span-3 rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div><p className="text-[10px] uppercase tracking-[0.16em] text-cyan-300 font-bold">Evolução</p><h3 className="text-base font-bold text-white mt-0.5">Faturamento por dia</h3></div>
            <span className="text-[10px] text-slate-500">Passe o período para comparar tendências.</span>
          </div>
          {metrics.daily.every((item) => item.revenue === 0) ? (
            <div className="h-44 flex items-center justify-center text-xs text-slate-500 rounded-2xl border border-dashed border-slate-800">Ainda não há faturamento neste período.</div>
          ) : (
            <div className="h-52 flex items-end gap-1.5 sm:gap-2 overflow-x-auto pb-2">
              {metrics.daily.map((item) => {
                const height = Math.max(item.revenue > 0 ? 8 : 2, (item.revenue / maxDailyRevenue) * 100);
                return (
                  <div key={item.date} className="min-w-[32px] flex-1 h-full flex flex-col justify-end items-center gap-1.5 group" title={`${formatShortDate(item.date)} • ${formatMoney(item.revenue)} • ${item.count} atendimentos`}>
                    <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{formatMoney(item.revenue)}</span>
                    <div className="w-full max-w-12 rounded-t-xl bg-gradient-to-t from-cyan-500/55 to-emerald-400/80 border border-cyan-300/10" style={{ height: `${height}%` }} />
                    <span className="text-[9px] text-slate-500 font-mono">{formatShortDate(item.date)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="xl:col-span-2 rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5"><Users className="w-5 h-5 text-cyan-300" /><div><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">Relacionamento</p><h3 className="text-base font-bold text-white">Clientes no período</h3></div></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-3 text-center"><p className="text-2xl font-black text-white font-mono">{metrics.uniqueClients}</p><p className="text-[10px] text-slate-500 mt-1">Únicos</p></div>
            <div className="rounded-2xl bg-cyan-400/5 border border-cyan-400/15 p-3 text-center"><p className="text-2xl font-black text-cyan-300 font-mono">{metrics.newClients}</p><p className="text-[10px] text-slate-500 mt-1">Novos</p></div>
            <div className="rounded-2xl bg-emerald-400/5 border border-emerald-400/15 p-3 text-center"><p className="text-2xl font-black text-emerald-300 font-mono">{metrics.returningClients}</p><p className="text-[10px] text-slate-500 mt-1">Recorrentes</p></div>
          </div>

          <div className="mt-5 pt-5 border-t border-slate-800">
            <p className="text-xs font-bold text-white mb-3 flex items-center gap-2"><WalletCards className="w-4 h-4 text-cyan-300" /> Recebimentos</p>
            <div className="space-y-2.5 text-xs">
              {[
                ['Pix', metrics.payment.pix],
                ['Cartão', metrics.payment.card],
                ['Dinheiro', metrics.payment.cash],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2.5">
                  <span className="text-slate-400">{label}</span><strong className="text-white font-mono">{formatMoney(Number(value))}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5"><Scissors className="w-5 h-5 text-emerald-400" /><div><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">Serviços</p><h3 className="text-base font-bold text-white">Mais procurados</h3></div></div>
          {metrics.services.length === 0 ? <p className="text-xs text-slate-500">Nenhum serviço concluído no período.</p> : (
            <div className="space-y-4">
              {metrics.services.slice(0, 6).map((service, index) => (
                <div key={`${service.name}-${index}`}>
                  <div className="flex items-center justify-between gap-3 text-xs mb-1.5"><span className="text-slate-200 font-semibold truncate">{index + 1}. {service.name}</span><span className="text-slate-400 shrink-0">{service.count}x • <strong className="text-white">{formatMoney(service.revenue)}</strong></span></div>
                  <div className="h-2 rounded-full bg-slate-950 overflow-hidden"><div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.max(5, (service.count / maxServiceCount) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5"><UserRoundCheck className="w-5 h-5 text-cyan-300" /><div><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">Equipe</p><h3 className="text-base font-bold text-white">Desempenho por profissional</h3></div></div>
          {metrics.barberStats.length === 0 ? <p className="text-xs text-slate-500">Nenhum atendimento concluído no período.</p> : (
            <div className="space-y-4">
              {metrics.barberStats.map(({ barber, count, gross, commission }) => (
                <div key={barber.id}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0"><p className="text-xs font-bold text-white truncate">{barber.full_name}</p><p className="text-[10px] text-slate-500 mt-0.5">{count} atendimentos • comissão {barber.commission_rate}%</p></div>
                    <div className="text-right shrink-0"><p className="text-xs font-black text-emerald-300 font-mono">{formatMoney(gross)}</p><p className="text-[10px] text-amber-300">{formatMoney(commission)} comissão</p></div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-950 overflow-hidden"><div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${Math.max(5, (gross / maxBarberGross) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5"><CalendarRange className="w-5 h-5 text-cyan-300" /><div><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">Demanda</p><h3 className="text-base font-bold text-white">Dias mais movimentados</h3></div></div>
          <div className="grid grid-cols-7 gap-2 items-end h-40">
            {metrics.weekdayCounts.map((item) => {
              const height = Math.max(item.count > 0 ? 10 : 3, (item.count / maxWeekday) * 100);
              return <div key={item.name} className="h-full flex flex-col justify-end items-center gap-2"><span className="text-[10px] font-bold text-white font-mono">{item.count}</span><div className="w-full max-w-10 rounded-t-lg bg-blue-400/60" style={{ height: `${height}%` }} /><span className="text-[9px] text-slate-500">{item.name}</span></div>;
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5"><Clock3 className="w-5 h-5 text-amber-300" /><div><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">Horários</p><h3 className="text-base font-bold text-white">Faixas com maior movimento</h3></div></div>
          {metrics.hours.length === 0 ? <p className="text-xs text-slate-500">Sem dados suficientes para este período.</p> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {metrics.hours.slice(0, 6).map((item, index) => (
                <div key={item.hour} className={`rounded-2xl border p-3 ${index === 0 ? 'border-amber-400/25 bg-amber-400/10' : 'border-slate-800 bg-slate-950/50'}`}>
                  <p className={`text-lg font-black font-mono ${index === 0 ? 'text-amber-300' : 'text-white'}`}>{item.hour}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{item.count} agendamentos</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
