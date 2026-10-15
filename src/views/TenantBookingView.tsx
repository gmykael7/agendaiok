import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { 
  CheckCircle, Clock, Calendar, 
  MapPin, Phone, MessageSquare, ArrowLeft, User, 
  Sparkles, Check, ChevronLeft, ChevronRight, AlertCircle, Share2, Plus, CheckSquare, Square, Lock, ShoppingBag, ShoppingCart, Minus, PackageCheck, Image as ImageIcon,
  Zap
} from 'lucide-react';
import { Organization, Service, Barber, Appointment, Product, WaitlistEntry } from '../types';
import { pushAppointmentToCloud, pushProductOrderToCloud } from '../services/cloudSync';
import { BarberAvatar } from '../components/common/BarberAvatar';
import { BrandLogo } from '../components/common/BrandLogo';
import { ActionButton } from '../components/common/ActionButton';
import { AgencyCredit } from '../components/common/AgencyCredit';
import { BookingAssistant } from '../components/common/BookingAssistant';
import { PublicShowcase } from '../components/common/PublicShowcase';
import { PublicThemeToggle } from '../components/common/PublicThemeToggle';
import { PageSeo } from '../components/common/PageSeo';
import { PublicWaitlistModal } from '../components/waitlist/PublicWaitlistModal';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../components/common/TurnstileWidget';
import { assistantSlots } from '../services/bookingAssistant';
import type { AssistantSlot } from '../services/bookingAssistant';
import { generateBusinessSlots, getBusinessClosureAtTime, getBusinessClosuresForDate, isBookableBusinessDateTime, isBookableBusinessTime, isBusinessClosedAllDay, overlapsBusinessClosure, timeToMinutes } from '../utils/scheduling';
import { getPublicBookingDateStatus, isPublicTimeSlotOccupied } from '../utils/publicBookingAvailability';
import { buildWhatsAppUrl } from '../utils/whatsapp';
import { filterServiceCatalog } from '../utils/serviceCatalog';
import { buildGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarLinks';
import { gsap, MOTION_ALLOWED_QUERY, useGSAP } from '../utils/motion';
import type { AppThemeMode } from '../config/theme';

interface TenantBookingViewProps {
  org: Organization;
  services: Service[];
  barbers: Barber[];
  appointments: Appointment[];
  products?: Product[];
  onProductsChanged?: (products: Product[]) => void;
  onAddAppointment: (newApp: Omit<Appointment, 'id'> & { id?: string }) => Appointment | void;
  onAddWaitlist?: (entry: WaitlistEntry) => void;
  onBackToAdmin?: () => void;
  isStandalone?: boolean;
  appThemeMode?: AppThemeMode;
  onThemeModeChange?: (mode: AppThemeMode) => void;
}

// Verifica se um slot de horário está ocupado por agendamento existente
export const isTimeSlotOccupied = (
  slotTime: string,
  candidateDurationMinutes: number,
  barberId: string,
  dateStr: string,
  allAppointments: Appointment[],
  excludeAppointmentId?: string
): boolean => isPublicTimeSlotOccupied(slotTime, candidateDurationMinutes, barberId, dateStr, allAppointments, excludeAppointmentId);


const getLocalDateStr = (now = new Date()): string => {
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return shifted.toISOString().split('T')[0];
};

const getLocalTimeStr = (now = new Date()): string =>
  now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

const closureLabel = (period: { all_day?: boolean; start?: string; end?: string; reason?: string }): string => {
  const reason = period.reason || 'Fechado excepcionalmente';
  if (period.all_day) return reason;
  return `${reason} • ${period.start || '--:--'} às ${period.end || '--:--'}`;
};

const addDaysToDate = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
};

const toLocalDateKey = (date: Date): string => {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

// Indicador de progresso animado do fluxo de agendamento (5 etapas).
const BOOKING_STEP_LABELS = ['Data', 'Serviços', 'Profissional', 'Horário', 'Contato'];

const BookingProgressStepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  return (
    <div className="mb-1 select-none" aria-hidden="false">
      <div className="flex items-center">
        {BOOKING_STEP_LABELS.map((label, idx) => {
          const stepNumber = idx + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isLast = idx === BOOKING_STEP_LABELS.length - 1;

          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold border transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                      : isActive
                        ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 scale-110 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
                        : 'bg-[#0B1120] border-slate-700 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <Check key="check" className="w-3.5 h-3.5 stroke-[3] animate-popIn" />
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </div>
                <span className={`hidden sm:block text-[9px] font-semibold tracking-wide uppercase transition-colors duration-300 ${
                  isActive ? 'text-emerald-300' : isCompleted ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {label}
                </span>
              </div>

              {!isLast && (
                <div className="flex-1 h-[2px] bg-slate-800 mx-1 sm:mx-1.5 rounded-full overflow-hidden -mt-4 sm:-mt-4">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 booking-progress-fill rounded-full"
                    style={{ width: stepNumber < currentStep ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const TenantBookingView: React.FC<TenantBookingViewProps> = ({
  org,
  services,
  barbers,
  appointments,
  products = [],
  onProductsChanged,
  onAddAppointment,
  onAddWaitlist,
  onBackToAdmin,
  isStandalone = false,
  appThemeMode = 'dark',
  onThemeModeChange,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const goToStep = (next: 1 | 2 | 3 | 4 | 5) => {
    setStepDirection(next >= step ? 'forward' : 'backward');
    setStep(next);
  };
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateStr());
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [lastCreatedAppointment, setLastCreatedAppointment] = useState<Appointment | null>(null);
  const [bookingError, setBookingError] = useState<string>('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingButtonStatus, setBookingButtonStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [statusClock, setStatusClock] = useState(() => new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
  });
  const [publicMode, setPublicMode] = useState<'services' | 'products'>('services');
  const [productCart, setProductCart] = useState<Record<string, number>>({});
  const [productCustomerName, setProductCustomerName] = useState('');
  const [productCustomerPhone, setProductCustomerPhone] = useState('');
  const [productOrderError, setProductOrderError] = useState('');
  const [productOrderSuccess, setProductOrderSuccess] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [isSubmittingProductOrder, setIsSubmittingProductOrder] = useState(false);
  const [bookingTurnstileToken, setBookingTurnstileToken] = useState('');
  const [productTurnstileToken, setProductTurnstileToken] = useState('');
  const bookingRootRef = useRef<HTMLDivElement | null>(null);
  const bookingTurnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const productTurnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const handleBookingTurnstileToken = useCallback((token: string) => {
    setBookingTurnstileToken(token);
    if (token) setBookingError((current) => current.includes('verificação de segurança') ? '' : current);
  }, []);

  const handleProductTurnstileToken = useCallback((token: string) => {
    setProductTurnstileToken(token);
    if (token) setProductOrderError((current) => current.includes('verificação de segurança') ? '' : current);
  }, []);

  const chooseAssistantSlot = (slot: AssistantSlot): string | null => {
    const service = services.find(item => item.id === slot.serviceId && item.active !== false);
    const barber = barbers.find(item => item.id === slot.barberId && item.active !== false);
    const available = assistantSlots({ org, services, barbers, appointments }, slot).some(item => item.time === slot.time && item.barberId === slot.barberId);
    if (!service || !barber || !available) return 'Essa opção não está mais disponível. Consulte novamente ou escolha outro horário.';
    setSelectedDate(slot.date);
    setSelectedServices([service]);
    setSelectedBarber(barber);
    setSelectedTime(slot.time);
    setBookingError('');
    goToStep(5);
    window.requestAnimationFrame(() => {
      const form = bookingRootRef.current?.querySelector<HTMLFormElement>('form[data-booking-panel]');
      form?.scrollIntoView({ behavior: 'auto', block: 'center' });
      form?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    });
    return null;
  };

  useEffect(() => {
    const timer = window.setInterval(() => setStatusClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add(MOTION_ALLOWED_QUERY, () => {
      const shell = bookingRootRef.current?.querySelector('[data-booking-shell]');
      if (!shell) return;
      return gsap.from(shell, {
        autoAlpha: 0,
        y: 18,
        scale: 0.992,
        duration: 0.62,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      });
    });
    return () => media.revert();
  }, { scope: bookingRootRef });

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add(MOTION_ALLOWED_QUERY, () => {
      const panel = bookingRootRef.current?.querySelector<HTMLElement>('[data-booking-panel]');
      if (!panel) return;

      const horizontalOffset = publicMode === 'services'
        ? (stepDirection === 'forward' ? 24 : -24)
        : 0;
      const timeline = gsap.timeline();
      timeline.fromTo(panel,
        { autoAlpha: 0, x: horizontalOffset, y: publicMode === 'products' ? 14 : 0 },
        { autoAlpha: 1, x: 0, y: 0, duration: 0.4, ease: 'power3.out', clearProps: 'opacity,visibility,transform' },
      );
      timeline.fromTo(Array.from(panel.children),
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.035, ease: 'power2.out', clearProps: 'opacity,visibility,transform' },
        '-=0.24',
      );
      return timeline;
    });
    return () => media.revert();
  }, {
    scope: bookingRootRef,
    dependencies: [step, stepDirection, publicMode, confirmed, productOrderSuccess],
    revertOnUpdate: true,
  });

  // Calendário público: permite agendamentos futuros por até 90 dias,
  // incluindo o mês seguinte sem transformar a escolha de data em uma lista enorme.
  const bookingWindow = useMemo(() => {
    const today = new Date(statusClock.getFullYear(), statusClock.getMonth(), statusClock.getDate(), 12, 0, 0, 0);
    const maxDate = addDaysToDate(today, 90);
    return {
      today,
      todayKey: toLocalDateKey(today),
      maxDate,
      maxDateKey: toLocalDateKey(maxDate),
      minMonth: new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0),
      maxMonth: new Date(maxDate.getFullYear(), maxDate.getMonth(), 1, 12, 0, 0, 0),
    };
  }, [statusClock]);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0);
    const leading = firstDay.getDay();
    const cells: Array<{ dateStr: string; day: number; disabledByRange: boolean } | null> = [];

    for (let i = 0; i < leading; i += 1) cells.push(null);
    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(year, month, day, 12, 0, 0, 0);
      const dateStr = toLocalDateKey(date);
      cells.push({
        dateStr,
        day,
        disabledByRange: dateStr < bookingWindow.todayKey || dateStr > bookingWindow.maxDateKey,
      });
    }
    return cells;
  }, [visibleMonth, bookingWindow.todayKey, bookingWindow.maxDateKey]);

  const visibleMonthLabel = useMemo(
    () => visibleMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [visibleMonth],
  );

  const canGoPreviousMonth = visibleMonth.getTime() > bookingWindow.minMonth.getTime();
  const canGoNextMonth = visibleMonth.getTime() < bookingWindow.maxMonth.getTime();

  const moveCalendarMonth = (direction: -1 | 1) => {
    setVisibleMonth((current) => {
      const candidate = new Date(current.getFullYear(), current.getMonth() + direction, 1, 12, 0, 0, 0);
      if (candidate < bookingWindow.minMonth) return bookingWindow.minMonth;
      if (candidate > bookingWindow.maxMonth) return bookingWindow.maxMonth;
      return candidate;
    });
  };

  // Slots de 30 min respeitando abertura, fechamento e intervalo de descanso.
  const timeSlots = useMemo(() => generateBusinessSlots(org, 30, 30), [
    org.open_hour,
    org.close_hour,
    org.break_enabled,
    org.break_start,
    org.break_end,
  ]);

  // No dia atual, horários que já passaram não devem continuar aparecendo para o cliente.
  // Ex.: às 17:00, 08:00–17:00 desaparecem e o próximo slot futuro permanece disponível.
  const visibleTimeSlots = useMemo(() => {
    if (selectedDate !== bookingWindow.todayKey) return timeSlots;
    const nowMinutes = statusClock.getHours() * 60 + statusClock.getMinutes();
    return timeSlots.filter((time) => timeToMinutes(time) > nowMinutes);
  }, [timeSlots, selectedDate, bookingWindow.todayKey, statusClock]);

  const selectedDateClosures = useMemo(
    () => getBusinessClosuresForDate(org, selectedDate),
    [org.closed_periods, selectedDate],
  );
  const selectedDateFullyClosed = useMemo(
    () => isBusinessClosedAllDay(org, selectedDate),
    [org.closed_periods, selectedDate],
  );
  const currentClosure = useMemo(() => {
    const today = getLocalDateStr(statusClock);
    return getBusinessClosureAtTime(org, today, getLocalTimeStr(statusClock));
  }, [org.closed_periods, statusClock]);

  // Serviços ativos
  const activeServices = useMemo(() => {
    return services.filter(s => s.active !== false);
  }, [services]);

  const publicProducts = useMemo(() => products.filter((product) => product.active !== false && product.public_visible !== false && Number(product.stock || 0) > 0), [products]);
  const serviceCategories = [...new Set(activeServices.map(service => service.category).filter(Boolean))];
  const effectiveServiceCategory = serviceCategories.includes(serviceCategory) ? serviceCategory : '';
  const visibleServices = filterServiceCatalog(activeServices, serviceQuery, effectiveServiceCategory);

  const productCartItems = useMemo(() => Object.entries(productCart).map(([productId, quantity]) => {
    const product = publicProducts.find((item) => item.id === productId);
    return product && quantity > 0 ? { product, quantity } : null;
  }).filter(Boolean) as Array<{ product: Product; quantity: number }>, [productCart, publicProducts]);

  const productCartTotal = useMemo(() => productCartItems.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0), [productCartItems]);

  const changeProductCart = (product: Product, delta: number) => {
    setProductCart((current) => {
      const next = { ...current };
      const quantity = Math.max(0, Math.min(Number(product.stock || 0), Number(current[product.id] || 0) + delta));
      if (quantity <= 0) delete next[product.id];
      else next[product.id] = quantity;
      return next;
    });
    setProductOrderError('');
  };

  const productWhatsAppUrl = () => {
    const phoneDigits = String(org.phone || '').replace(/\D/g, '');
    const phone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    const lines = productCartItems.map(({ product, quantity }) => `• ${quantity}x ${product.name} - R$ ${(product.price * quantity).toFixed(2)}`);
    const text = [
      `*Pedido de produtos - ${org.name}*`,
      '',
      ...lines,
      '',
      `*Total:* R$ ${productCartTotal.toFixed(2)}`,
      org.pix_key ? `*Pix:* ${org.pix_key}${org.pix_holder ? ` (${org.pix_holder})` : ''}` : '',
      '',
      `Cliente: ${productCustomerName}`,
      `WhatsApp: ${productCustomerPhone}`,
    ].filter(Boolean).join('\n');
    return buildWhatsAppUrl(phone, text);
  };

  const submitProductOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setProductOrderError('');
    if (!productCustomerName.trim() || !productCustomerPhone.trim()) {
      setProductOrderError('Informe seu nome e WhatsApp para concluir o pedido.');
      return;
    }
    if (productCartItems.length === 0) {
      setProductOrderError('Adicione pelo menos um produto ao carrinho.');
      return;
    }
    if (!productTurnstileToken) {
      setProductOrderError('Aguarde ou conclua a verificação de segurança para enviar o pedido.');
      return;
    }
    setIsSubmittingProductOrder(true);
    const waUrl = productWhatsAppUrl();
    const result = await pushProductOrderToCloud({
      org_slug: org.slug,
      customer_name: productCustomerName.trim(),
      customer_phone: productCustomerPhone.trim(),
      items: productCartItems.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
    }, productTurnstileToken);
    setIsSubmittingProductOrder(false);
    productTurnstileRef.current?.reset();
    if (!result.ok) {
      setProductOrderError(result.error || 'Não foi possível concluir o pedido.');
      return;
    }
    if (result.products) onProductsChanged?.(result.products);
    setProductOrderSuccess(true);
    setProductCart({});
    try { window.open(waUrl, '_blank'); } catch {}
  };

  // Barbeiros ativos
  const activeBarbers = useMemo(() => {
    return barbers.filter(b => b.active !== false);
  }, [barbers]);

  const calendarDateStatuses = useMemo(() => {
    const statuses = new Map<string, ReturnType<typeof getPublicBookingDateStatus>>();
    calendarDays.forEach((cell) => {
      if (!cell || cell.disabledByRange) return;
      statuses.set(cell.dateStr, getPublicBookingDateStatus({
        org,
        services: activeServices,
        barbers: activeBarbers,
        appointments,
        dateStr: cell.dateStr,
        now: statusClock,
      }));
    });
    return statuses;
  }, [calendarDays, org, activeServices, activeBarbers, appointments, statusClock]);

  // Totais calculados dos serviços selecionados
  const totalPrice = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + s.price, 0);
  }, [selectedServices]);

  const totalDuration = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
  }, [selectedServices]);

  // Alternar seleção de serviço (suporte a múltiplos serviços)
  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  // Gerar link direto do WhatsApp da Barbearia com a mensagem formatada incluindo todos os serviços
  const generateWhatsAppUrl = (app: Appointment) => {
    const cleanPhone = (org.phone || '').replace(/\D/g, '');
    const formattedSelectedDate = new Date((app.date || selectedDate) + 'T00:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const servicesListText = (app.services && app.services.length > 0)
      ? app.services.map(s => `• ${s.name} - R$ ${s.price.toFixed(2)} (${s.duration_minutes} min)`).join('\n')
      : `• ${app.service_name} - R$ ${app.price.toFixed(2)}`;

    const textLines = [
      `*NOVO AGENDAMENTO ONLINE - ${org.name.toUpperCase()}*`,
      '',
      `• *Cliente:* ${app.client_name}`,
      `• *WhatsApp:* ${app.client_phone}`,
      '',
      `• *Serviços Agendados (${app.services?.length || 1}):*`,
      servicesListText,
      '',
      `• *Valor Total:* R$ ${app.price.toFixed(2)} (${app.duration_minutes || totalDuration} min)`,
      `• *Profissional:* ${app.barber_name}`,
      `• *Data:* ${formattedSelectedDate}`,
      `• *Horário:* às ${app.start_time}`,
      '',
      `_Agendamento registrado no sistema AgendAI._`
    ];

    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    return buildWhatsAppUrl(fullPhone, textLines.join('\n'));
  };

  const handleFinishBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');

    if (selectedServices.length === 0 || !selectedBarber || !selectedTime || !clientName.trim() || !clientPhone.trim()) {
      return;
    }

    if (!bookingTurnstileToken) {
      setBookingError('Aguarde ou conclua a verificação de segurança para confirmar o agendamento.');
      return;
    }

    if (!isBookableBusinessDateTime(selectedTime, totalDuration, selectedDate, org)) {
      const exceptionalClosure = selectedDateClosures.find((period) => {
        if (period.all_day) return true;
        return overlapsBusinessClosure(selectedTime, totalDuration, selectedDate, { ...org, closed_periods: [period] });
      });
      if (exceptionalClosure) {
        setBookingError(`⚠️ ${closureLabel(exceptionalClosure)}. Escolha outro horário ou outra data.`);
      } else {
        setBookingError(org.break_enabled
          ? `⚠️ Esse horário entra no período de descanso da barbearia (${org.break_start || '12:00'} às ${org.break_end || '14:00'}). Escolha outro horário.`
          : '⚠️ Esse horário está fora do expediente da barbearia.');
      }
      goToStep(4);
      setSelectedTime('');
      return;
    }

    // VERIFICAÇÃO RIGOROSA DE DISPONIBILIDADE ANTES DE CONFIRMAR
    const isOccupied = isTimeSlotOccupied(
      selectedTime,
      totalDuration,
      selectedBarber.id,
      selectedDate,
      appointments
    );

    if (isOccupied) {
      setBookingError(`⚠️ O horário das ${selectedTime} já foi reservado ou colide com outro agendamento. Por favor, escolha outro horário livre.`);
      goToStep(4);
      setSelectedTime('');
      return;
    }

    const joinedNames = selectedServices.map(s => s.name).join(' + ');

    const newApp: Omit<Appointment, 'id'> = {
      org_id: org.id,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      service_id: selectedServices[0]?.id || '',
      service_name: joinedNames,
      services: selectedServices.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration_minutes: s.duration_minutes || 30,
        category: s.category,
      })),
      duration_minutes: totalDuration,
      barber_id: selectedBarber.id,
      barber_name: selectedBarber.full_name,
      start_time: selectedTime,
      price: totalPrice,
      status: 'scheduled',
      date: selectedDate,
    };

    const fullApp: Appointment = {
      ...newApp,
      id: 'app-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      created_at: new Date().toISOString(),
    };

    // Confirma primeiro no servidor. Assim o cliente nunca recebe uma confirmação falsa
    // quando outro aparelho acabou de reservar o mesmo horário.
    setIsSubmittingBooking(true);
    setBookingButtonStatus('loading');
    const cloudResult = await pushAppointmentToCloud(fullApp, org.slug, bookingTurnstileToken);
    setIsSubmittingBooking(false);
    bookingTurnstileRef.current?.reset();

    if (!cloudResult.ok) {
      setBookingButtonStatus('idle');
      setBookingError(cloudResult.error || 'Não foi possível confirmar o agendamento. Tente novamente.');
      if (cloudResult.status === 409) {
        setSelectedTime('');
        goToStep(4);
      }
      return;
    }

    // Mostra o check por um instante antes de trocar para a tela de confirmação.
    setBookingButtonStatus('success');
    await new Promise((resolve) => window.setTimeout(resolve, 650));

    const savedAppointment = cloudResult.appointment || fullApp;
    const created = onAddAppointment(savedAppointment);
    const confirmedApp = (created && created.id) ? created : savedAppointment;
    setLastCreatedAppointment(confirmedApp);
    setConfirmed(true);

    const waUrl = generateWhatsAppUrl(confirmedApp);
    try {
      window.open(waUrl, '_blank');
    } catch {
      // Se o navegador bloquear o popup, a tela de confirmação mantém o acesso ao WhatsApp.
    }
  };

  const bookingStructuredData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: org.name,
    url: `https://meuagendai.fun/agendar/${encodeURIComponent(org.slug)}`,
    telephone: org.phone || undefined,
    image: org.logo_image_url || org.cover_image_url || undefined,
    address: org.address ? {
      '@type': 'PostalAddress',
      streetAddress: org.address,
      addressLocality: org.city || undefined,
      addressRegion: org.state || undefined,
      addressCountry: 'BR',
    } : undefined,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Serviços',
      itemListElement: services.filter((service) => service.active !== false).slice(0, 30).map((service) => ({
        '@type': 'Offer',
        price: Number(service.price).toFixed(2),
        priceCurrency: 'BRL',
        itemOffered: { '@type': 'Service', name: service.name, description: service.description || undefined },
      })),
    },
    potentialAction: {
      '@type': 'ReserveAction',
      target: `https://meuagendai.fun/agendar/${encodeURIComponent(org.slug)}`,
      result: { '@type': 'Reservation', name: 'Agendamento de serviço' },
    },
  }), [org, services]);

  return (
    <div ref={bookingRootRef} className={`booking-view w-full ${isStandalone ? 'min-h-screen bg-[#070B14] py-4 sm:py-8 px-2 sm:px-4 flex items-center justify-center' : 'max-w-xl mx-auto py-2 sm:py-4 animate-fadeIn'}`}>
      <PageSeo title={`${org.name} | Agendamento online`} description={`Veja serviços, profissionais e horários disponíveis e agende seu atendimento online na ${org.name}.`} path={`/agendar/${org.slug}`} structuredData={bookingStructuredData} noIndex={!isStandalone} />
      <div className={`w-full ${publicMode === 'products' ? 'max-w-7xl' : 'max-w-2xl'}`}>
        {isStandalone && onThemeModeChange && (
          <div className="mb-3 flex justify-end">
            <PublicThemeToggle mode={appThemeMode} onChange={onThemeModeChange} />
          </div>
        )}
        {/* BOTÃO DE RETORNO AO PAINEL (APENAS PARA O ADMINISTRADOR) */}
        {!isStandalone && onBackToAdmin && (
          <div className="flex justify-between items-center mb-3">
            <button
              onClick={onBackToAdmin}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl transition-colors active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Regressar ao Painel
            </button>
            <span className="text-[10px] text-slate-500 font-mono">Modo Cliente</span>
          </div>
        )}

        <div data-booking-shell className="bg-[#121B2E] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* VITRINE DO ESTABELECIMENTO */}
          <div className="border-b border-slate-800 bg-slate-950/30">
            <div className="relative h-32 sm:h-40 overflow-hidden bg-gradient-to-br from-cyan-500/25 via-slate-950 to-blue-600/25">
              {org.cover_image_url ? (
                <img src={org.cover_image_url} alt={`Capa ${org.name}`} className="absolute inset-0 w-full h-full object-cover booking-cover-image" />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.22),transparent_38%)]" />
              )}
              <div className="booking-cover-shade absolute inset-0" />
              <span className="booking-cover-badge absolute top-3 right-3 rounded-full border border-white/15 bg-black/45 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-white">Agendamento online</span>
            </div>

            <div className="px-5 sm:px-7 pb-5 sm:pb-6 -mt-8 relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className={`organization-avatar w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border-4 border-[#121B2E] flex items-center justify-center shadow-2xl shadow-black/30 shrink-0 ${org.logo_image_url ? 'p-0' : 'p-2'}`}>
                  {org.logo_image_url ? (
                    <img
                      src={org.logo_image_url}
                      alt={`Logo ${org.name}`}
                      className="w-full h-full rounded-full object-cover object-center"
                    />
                  ) : (
                    <BrandLogo variant="mark" className="w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <h1 className="booking-cover-title font-display text-2xl sm:text-3xl font-normal text-white tracking-tight">{org.name}</h1>
                  <p className="text-[11px] sm:text-xs text-cyan-300 font-semibold mt-1">Agende seus serviços ou compre produtos físicos na mesma página.</p>
                </div>
              </div>

              <div className="space-y-2 mt-4">
                {org.address && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-2.5 flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[10px] text-slate-300 truncate">{org.address}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`https://wa.me/${String(org.phone || '').replace(/\D/g, '').startsWith('55') ? String(org.phone || '').replace(/\D/g, '') : `55${String(org.phone || '').replace(/\D/g, '')}`}`} target="_blank" rel="noopener noreferrer" className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/45 px-2.5 sm:px-3 py-2.5 flex items-center gap-2 hover:border-emerald-500/30 transition-colors">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="min-w-0 truncate text-[9px] sm:text-[10px] text-slate-300">{org.phone || 'WhatsApp'}</span>
                  </a>
                  <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/45 px-2.5 sm:px-3 py-2.5 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="min-w-0 whitespace-nowrap text-[9px] sm:text-[10px] text-slate-300">{org.open_hour || '08:00'} às {org.close_hour || '20:00'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <PublicShowcase org={org} />


          {publicMode === 'services' && !confirmed && (
            <BookingAssistant key={org.slug} org={org} services={services} barbers={barbers} appointments={appointments} onChooseSlot={chooseAssistantSlot} />
          )}

          {publicMode === 'services' && currentClosure && (
            <div className={`mx-4 sm:mx-6 mt-4 rounded-2xl border p-4 flex items-start gap-3 ${currentClosure.all_day ? 'border-rose-400/30 bg-rose-400/10' : 'border-amber-400/30 bg-amber-400/10'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${currentClosure.all_day ? 'bg-rose-400/15' : 'bg-amber-400/15'}`}>
                <Lock className={`w-4 h-4 ${currentClosure.all_day ? 'text-rose-300' : 'text-amber-300'}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-black tracking-wide ${currentClosure.all_day ? 'text-rose-200' : 'text-amber-200'}`}>
                  {currentClosure.all_day ? 'FECHADO HOJE' : 'FECHADO AGORA'}
                </p>
                <p className="text-[11px] text-slate-300 mt-1">{currentClosure.reason || 'Fechado excepcionalmente'}.</p>
                <p className="text-[11px] font-semibold text-slate-200 mt-1.5">
                  {currentClosure.all_day
                    ? 'Hoje não teremos atendimento. Escolha outra data disponível.'
                    : `Retornamos às ${currentClosure.end || '--:--'}. Você pode agendar normalmente para depois desse horário.`}
                </p>
              </div>
            </div>
          )}

          <div className="mx-4 sm:mx-6 mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950/45 p-1.5">
            <button type="button" onClick={() => { setPublicMode('services'); setProductOrderError(''); }} className={`rounded-xl px-3 py-2.5 text-xs font-black flex items-center justify-center gap-2 ${publicMode === 'services' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}><Calendar className="w-4 h-4" />Agendar serviços</button>
            <button type="button" onClick={() => { setPublicMode('products'); setBookingError(''); }} className={`rounded-xl px-3 py-2.5 text-xs font-black flex items-center justify-center gap-2 ${publicMode === 'products' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}><ShoppingBag className="w-4 h-4" />Comprar produtos</button>
          </div>

          {/* MENSAGEM DE ERRO/ALERTA DE HORÁRIO OCUPADO */}
          {publicMode === 'services' && bookingError && (
            <div className="mx-4 sm:mx-6 mt-4 p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{bookingError}</span>
            </div>
          )}

          {publicMode === 'products' && productOrderError && (
            <div role="alert" className="mx-4 sm:mx-6 mt-4 p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-rose-300 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{productOrderError}</div>
          )}

          {/* SERVIÇOS E PRODUTOS FICAM EM FLUXOS SEPARADOS */}
          {publicMode === 'products' ? (
            productOrderSuccess ? (
              <div data-booking-panel className="p-6 sm:p-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 mx-auto flex items-center justify-center"><PackageCheck className="w-8 h-8" /></div>
                <div><h2 className="text-xl font-black text-white">Pedido recebido!</h2><p className="text-xs text-slate-400 mt-1">A barbearia recebeu seu pedido. Os itens foram reservados no estoque.</p></div>
                <button type="button" onClick={() => { setProductOrderSuccess(false); setProductCustomerName(''); setProductCustomerPhone(''); }} className="w-full rounded-xl bg-slate-800 px-4 py-3 text-xs font-black text-white">Fazer outro pedido</button>
              </div>
            ) : (
              <div data-booking-panel className="p-4 sm:p-6 grid xl:grid-cols-[1fr_300px] gap-5">
                <div className="space-y-3">
                  <div><h2 className="text-sm font-black text-white flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-cyan-300" />Produtos disponíveis</h2><p className="text-[11px] text-slate-500 mt-1">Produtos físicos separados do catálogo de serviços.</p></div>
                  {publicProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center"><ShoppingBag className="w-8 h-8 text-slate-700 mx-auto" /><p className="text-sm font-bold text-white mt-3">Nenhum produto disponível agora</p><p className="text-[11px] text-slate-500 mt-1">A vitrine será atualizada quando o estabelecimento cadastrar produtos com estoque.</p></div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">{publicProducts.map((product) => { const qty = productCart[product.id] || 0; return (
                      <div key={product.id} className="min-w-0 rounded-2xl border border-slate-800 bg-[#0B1120] p-2.5 sm:p-3.5">
                        <div className="aspect-square sm:aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">{product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-700" />}</div>
                        <p className="text-[9px] uppercase tracking-widest text-cyan-300 mt-3">{product.category}</p><h4 className="font-black text-white mt-0.5">{product.name}</h4>{product.description && <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{product.description}</p>}
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2"><div className="min-w-0"><p className="text-sm sm:text-lg font-black text-emerald-300 font-mono">R$ {product.price.toFixed(2)}</p><p className={`text-[9px] font-bold ${Number(product.stock) <= 3 ? 'text-amber-300' : 'text-slate-500'}`}>{Number(product.stock) <= 3 ? 'Últimas unidades' : 'Em estoque'}</p></div><div role="group" aria-label={`Quantidade de ${product.name}`} className="flex items-center justify-between sm:justify-start rounded-xl border border-slate-800 bg-slate-900 p-1 w-full sm:w-auto"><button type="button" disabled={!qty} aria-label={`Remover uma unidade de ${product.name}`} onClick={() => changeProductCart(product, -1)} className="h-11 w-11 flex items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-30"><Minus className="w-4 h-4" /></button><span aria-live="polite" aria-atomic="true" className="w-7 text-center text-xs font-black text-white">{qty}</span><button type="button" disabled={qty >= Number(product.stock)} aria-label={`Adicionar uma unidade de ${product.name}`} onClick={() => changeProductCart(product, 1)} className="h-11 w-11 rounded-lg bg-cyan-400/10 flex items-center justify-center text-cyan-200 transition-colors hover:bg-cyan-400/20 disabled:opacity-30"><Plus className="w-4 h-4" /></button></div></div>
                      </div>
                    ); })}</div>
                  )}
                </div>
                <form onSubmit={submitProductOrder} aria-labelledby="product-checkout-title" className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 h-fit space-y-3 xl:sticky xl:top-4">
                  <div className="flex items-center justify-between"><h3 id="product-checkout-title" className="text-sm font-black text-white flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-cyan-300" />Seu carrinho</h3><span aria-live="polite" aria-atomic="true" className="text-[10px] text-slate-500">{productCartItems.reduce((s, item) => s + item.quantity, 0)} itens</span></div>
                  {productCartItems.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-[10px] text-slate-500">Adicione um produto para começar.</p> : <div className="space-y-2 max-h-48 overflow-y-auto">{productCartItems.map(({ product, quantity }) => <div key={product.id} className="rounded-xl border border-slate-800 bg-[#0B1120] px-3 py-2 text-[10px] flex justify-between gap-2"><span className="text-white">{quantity}× {product.name}</span><strong className="text-emerald-300 font-mono">R$ {(product.price * quantity).toFixed(2)}</strong></div>)}</div>}
                  <div className="border-t border-slate-800 pt-3 flex justify-between items-center"><span className="text-xs text-slate-400">Total</span><strong aria-live="polite" aria-atomic="true" className="text-xl text-emerald-300 font-black font-mono">R$ {productCartTotal.toFixed(2)}</strong></div>
                  <div>
                    <label htmlFor="product-customer-name" className="mb-1.5 block text-xs font-semibold text-slate-300">Seu nome</label>
                    <input id="product-customer-name" name="customer_name" autoComplete="name" required value={productCustomerName} onChange={(e) => setProductCustomerName(e.target.value)} placeholder="Como devemos chamar você?" className="min-h-11 w-full rounded-xl border border-slate-800 bg-[#0B1120] px-3 py-2.5 text-xs text-white" />
                  </div>
                  <div>
                    <label htmlFor="product-customer-phone" className="mb-1.5 block text-xs font-semibold text-slate-300">Seu WhatsApp com DDD</label>
                    <input id="product-customer-phone" name="customer_phone" autoComplete="tel-national" inputMode="tel" required type="tel" value={productCustomerPhone} onChange={(e) => setProductCustomerPhone(e.target.value)} placeholder="(84) 99999-0000" className="min-h-11 w-full rounded-xl border border-slate-800 bg-[#0B1120] px-3 py-2.5 text-xs text-white" />
                  </div>
                  {org.pix_key && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-[10px] text-slate-300"><strong className="text-emerald-300 block">Pagamento via Pix disponível</strong>{org.pix_key}</div>}
                  <TurnstileWidget ref={productTurnstileRef} action="product_order" onTokenChange={handleProductTurnstileToken} />
                  <button disabled={!productCartItems.length || isSubmittingProductOrder} type="submit" className="min-h-11 w-full rounded-xl bg-cyan-400 py-3 text-xs font-black text-slate-950 disabled:opacity-40">{isSubmittingProductOrder ? 'Enviando pedido...' : 'Enviar pedido à barbearia'}</button>
                  <p className="text-[9px] text-center text-slate-500">O pedido entra no painel como pendente e os itens ficam reservados no estoque.</p>
                </form>
              </div>
            )
          ) : activeServices.length === 0 || activeBarbers.length === 0 ? (
            <div data-booking-panel className="p-8 sm:p-10 text-center space-y-4">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Barbearia em Configuração</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Este estabelecimento ainda está configurando os serviços e a equipe. Tente novamente em alguns minutos.
                </p>
              </div>
              {!isStandalone && onBackToAdmin && (
                <button
                  onClick={onBackToAdmin}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
                >
                  Configurar no Painel
                </button>
              )}
            </div>
          ) : confirmed && lastCreatedAppointment ? (
            /* TELA DE SUCESSO E ENVIO AO WHATSAPP */
            <div data-booking-panel className="p-5 sm:p-8 text-center space-y-5 sm:space-y-6">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 mx-auto">
                {/* Anel pulsante de celebração */}
                <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ringPulse" />
                <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ringPulse" style={{ animationDelay: '0.4s' }} />
                {/* Partículas leves ao redor do ícone */}
                {[...Array(6)].map((_, i) => {
                  const angle = (i / 6) * Math.PI * 2;
                  const dx = Math.cos(angle) * 34;
                  const dy = Math.sin(angle) * 34 - 10;
                  return (
                    <span
                      key={i}
                      className="booking-particle w-1.5 h-1.5 bg-emerald-300"
                      style={{
                        left: '50%',
                        top: '50%',
                        '--dx': `${dx}px`,
                        '--dy': `${dy}px`,
                        animationDelay: `${0.1 + i * 0.05}s`,
                      } as React.CSSProperties}
                    />
                  );
                })}
                <div className="relative w-full h-full bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10 animate-checkPop">
                  <CheckCircle className="w-9 h-9 sm:w-10 sm:h-10" />
                </div>
              </div>

              <div className="animate-riseIn" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Agendamento Confirmado!</h2>
                <p className="text-xs text-slate-300 mt-1">
                  Seu horário foi salvo e sincronizado no sistema da barbearia.
                </p>
              </div>

              {/* CARD DETALHADO DO AGENDAMENTO */}
              <div className="bg-[#0B1120] p-4 sm:p-5 rounded-2xl border border-slate-800 text-left space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cliente:</span>
                  <span className="text-white font-bold">{lastCreatedAppointment.client_name}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Barbeiro:</span>
                  <span className="text-white font-bold">{lastCreatedAppointment.barber_name}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Data e Horário:</span>
                  <span className="text-emerald-400 font-bold font-mono text-xs sm:text-sm">
                    {new Date((lastCreatedAppointment.date || selectedDate) + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {lastCreatedAppointment.start_time}
                  </span>
                </div>

                {/* LISTA DE SERVIÇOS INCLUSOS */}
                <div className="border-t border-slate-800/80 pt-2 space-y-1">
                  <span className="text-slate-400 font-semibold block">Serviços Selecionados:</span>
                  {lastCreatedAppointment.services && lastCreatedAppointment.services.length > 0 ? (
                    lastCreatedAppointment.services.map((srv, idx) => (
                      <div key={idx} className="flex justify-between items-center text-slate-300 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800/60">
                        <span>• {srv.name} <span className="text-[10px] text-slate-500">({srv.duration_minutes}m)</span></span>
                        <span className="font-mono font-bold text-white">R$ {srv.price.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between items-center text-slate-300">
                      <span>• {lastCreatedAppointment.service_name}</span>
                      <span className="font-mono font-bold text-white">R$ {lastCreatedAppointment.price.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between border-t border-slate-800/80 pt-2 font-bold">
                  <div>
                    <span className="text-slate-400 block">Total a Pagar:</span>
                    <span className="text-[10px] text-slate-500">Duração: {lastCreatedAppointment.duration_minutes || totalDuration} min</span>
                  </div>
                  <span className="text-emerald-400 font-black font-mono text-base sm:text-lg">R$ {lastCreatedAppointment.price.toFixed(2)}</span>
                </div>
              </div>

              {/* BOTÃO EM DESTAQUE DO WHATSAPP DA BARBEARIA */}
              <div className="space-y-2.5 pt-1">
                <a
                  href={generateWhatsAppUrl(lastCreatedAppointment)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 sm:py-4 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 text-sm active:scale-98"
                >
                  <MessageSquare className="w-5 h-5 fill-slate-950" />
                  Enviar no WhatsApp da Barbearia
                </a>

                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  Clique no botão para abrir o WhatsApp e avisar a barbearia sobre sua chegada.
                </p>

                {/* BOTÕES ADICIONAR AO CALENDÁRIO */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block text-center sm:text-left">
                    Salvar na sua Agenda:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href={buildGoogleCalendarUrl(org, lastCreatedAppointment)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                    >
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      Google Agenda
                    </a>

                    <button
                      type="button"
                      onClick={() => downloadIcsFile(org, lastCreatedAppointment)}
                      className="py-2.5 px-3 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                    >
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Apple / Outlook (.ics)
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setConfirmed(false);
                    goToStep(1);
                    const now = new Date();
                    setSelectedDate(getLocalDateStr(now));
                    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0));
                    setSelectedServices([]);
                    setSelectedBarber(null);
                    setSelectedTime('');
                    setClientName('');
                    setClientPhone('');
                    setBookingError('');
                  }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-colors"
                >
                  Fazer Outro Agendamento
                </button>
              </div>
            </div>
          ) : (
            /* PASSO A PASSO (1 a 5) */
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 booking-anim">
              <BookingProgressStepper currentStep={step} />

              {/* ETAPA 1: DATA */}
              {step === 1 && (
                <div key="step-1" data-booking-panel className="space-y-3.5 sm:space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs flex items-center justify-center font-bold">1</span>
                      Escolha a Data
                    </h2>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-[#0A1324]/70 p-2.5 sm:p-3">
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <button
                        type="button"
                        disabled={!canGoPreviousMonth}
                        onClick={() => moveCalendarMonth(-1)}
                        className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed hover:border-cyan-400/40 min-w-[44px] min-h-[44px]"
                        aria-label="Mês anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="text-center min-w-0">
                        <p className="text-sm sm:text-base font-black text-white capitalize">{visibleMonthLabel}</p>
                        <p className="text-[9px] sm:text-[10px] text-slate-500">Agendamentos disponíveis pelos próximos 90 dias</p>
                      </div>
                      <button
                        type="button"
                        disabled={!canGoNextMonth}
                        onClick={() => moveCalendarMonth(1)}
                        className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 flex items-center justify-center disabled:opacity-25 disabled:cursor-not-allowed hover:border-cyan-400/40 min-w-[44px] min-h-[44px]"
                        aria-label="Próximo mês"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                      {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((weekday) => (
                        <span key={weekday} className="py-1 text-[8px] sm:text-[9px] font-bold tracking-wide text-slate-600">{weekday}</span>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                      {calendarDays.map((cell, index) => {
                        if (!cell) return <div key={`empty-${index}`} className="min-h-[52px] sm:min-h-[62px]" aria-hidden="true" />;

                        const isToday = cell.dateStr === bookingWindow.todayKey;
                        const isSelected = selectedDate === cell.dateStr;
                        const dateStatus = calendarDateStatuses.get(cell.dateStr) || 'available';
                        const fullDayClosed = dateStatus === 'closed';
                        const hasNoAvailability = dateStatus === 'unavailable';
                        const closuresForDay = getBusinessClosuresForDate(org, cell.dateStr);
                        const hasSpecialClosure = !fullDayClosed && closuresForDay.length > 0;
                        const closedNow = isToday && Boolean(currentClosure) && !currentClosure?.all_day;
                        const disabled = cell.disabledByRange || fullDayClosed || hasNoAvailability;
                        const statusLabel = fullDayClosed
                          ? (isToday ? 'NÃO ATENDE HOJE' : 'NÃO ATENDE')
                          : hasNoAvailability
                            ? 'SEM HORÁRIO LIVRE'
                          : closedNow
                            ? 'FECHADO AGORA'
                            : hasSpecialClosure
                              ? 'HORÁRIO ESPECIAL'
                              : '';

                        return (
                          <button
                            key={cell.dateStr}
                            type="button"
                            aria-label={`${new Date(cell.dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${statusLabel ? `, ${statusLabel}` : ''}`}
                            aria-pressed={isSelected}
                            disabled={disabled}
                            onClick={() => {
                              if (disabled) return;
                              setSelectedDate(cell.dateStr);
                              setBookingError('');
                              goToStep(2);
                            }}
                            style={{ animationDelay: `${Math.min(index, 20) * 12}ms` }}
                            className={`stagger-item relative min-h-[52px] sm:min-h-[62px] rounded-xl border px-1 py-1.5 sm:py-2 text-center transition-all duration-200 flex flex-col items-center justify-center ${
                              cell.disabledByRange
                                ? 'bg-slate-950/20 text-slate-700 border-slate-900/50 cursor-not-allowed'
                                : fullDayClosed
                                  ? 'bg-slate-900/45 text-slate-500 border-slate-700/60 cursor-not-allowed'
                                  : hasNoAvailability
                                    ? 'booking-date-unavailable text-slate-400 border-rose-400/35 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20 font-bold scale-105 active:scale-95'
                                    : closedNow
                                      ? 'bg-amber-950/25 text-slate-200 border-amber-400/40 hover:border-amber-300/60 hover:-translate-y-0.5 active:scale-95'
                                      : hasSpecialClosure
                                        ? 'bg-amber-950/15 text-slate-300 border-amber-500/25 hover:border-amber-400/50 hover:-translate-y-0.5 active:scale-95'
                                        : 'bg-[#0B1120] text-slate-300 border-slate-800 hover:border-emerald-500/50 hover:-translate-y-0.5 active:scale-95'
                            }`}
                          >
                            {isToday && !cell.disabledByRange && (
                              <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-wide ${isSelected ? 'text-slate-800/70' : 'text-cyan-300'}`}>Hoje</span>
                            )}
                            <span className="text-sm sm:text-base font-black leading-none">{cell.day}</span>
                            {statusLabel && (
                              <span className={`mt-1 text-[5.5px] sm:text-[7px] leading-tight font-black uppercase tracking-[0.02em] ${
                                isSelected ? 'text-slate-900/80' : fullDayClosed ? 'text-slate-400' : hasNoAvailability ? 'text-rose-300' : 'text-amber-300'
                              }`}>
                                {statusLabel}
                              </span>
                            )}
                            {closedNow && currentClosure?.end && (
                              <span className={`mt-0.5 text-[5.5px] sm:text-[6.5px] leading-tight font-semibold ${isSelected ? 'text-slate-900/70' : 'text-slate-400'}`}>
                                Retorna {currentClosure.end}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-800/70 pt-3 text-[9px] sm:text-[10px] font-semibold text-slate-400" aria-label="Legenda do calendário">
                      <span className="flex items-center gap-1.5"><span className="booking-date-unavailable h-3.5 w-5 rounded border border-rose-400/35" aria-hidden="true" />Sem horário livre</span>
                      <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded border border-slate-700/60 bg-slate-900/45" aria-hidden="true" />Barbearia não atende</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ETAPA 2: SERVIÇOS (MÚLTIPLA ESCOLHA) */}
              {step === 2 && (
                <div key="step-2" data-booking-panel className="space-y-3.5 sm:space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs flex items-center justify-center font-bold">2</span>
                        Selecione os Serviços
                      </h2>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                        Pode marcar mais de um serviço para o mesmo pedido.
                      </p>
                    </div>
                    <button onClick={() => goToStep(1)} className="text-xs text-emerald-400 hover:underline shrink-0">
                      Alterar data
                    </button>
                  </div>

                  <label className="block text-xs text-slate-300" htmlFor="public-service-search">Buscar serviço</label>
                  <input id="public-service-search" type="search" value={serviceQuery} onChange={event => setServiceQuery(event.target.value)} placeholder="Ex.: corte, barba, Pai & Filho…" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
                  <div className="flex flex-wrap gap-2" aria-label="Categorias de serviços">
                    {['', ...serviceCategories].map(category => <button key={category} type="button" aria-pressed={effectiveServiceCategory === category} onClick={() => setServiceCategory(category)} className={`rounded-full border px-3 py-2 text-xs ${effectiveServiceCategory === category ? 'bg-emerald-400 text-slate-950 border-emerald-400' : 'border-slate-700 text-slate-300'}`}>{category || 'Todos'}</button>)}
                  </div>
                  <p className="text-xs text-slate-400" role="status">{visibleServices.length} serviço(s) encontrado(s). A busca não remove serviços já selecionados.</p>
                  {!visibleServices.length && <button type="button" onClick={() => { setServiceQuery(''); setServiceCategory(''); }} className="text-sm text-emerald-400">Nenhum resultado. Limpar filtros</button>}
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1 booking-scroll">
                    {visibleServices.map((service, index) => {
                      const isSelected = selectedServices.some(s => s.id === service.id);

                      return (
                        <div
                          key={service.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault(); toggleService(service);
                            }
                          }}
                          onClick={() => toggleService(service)}
                          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                          className={`stagger-item booking-card gap-2 p-3.5 rounded-2xl border cursor-pointer flex justify-between items-center group active:scale-98 ${
                            isSelected
                              ? 'bg-emerald-950/30 border-emerald-500/70 shadow-sm'
                              : 'bg-[#0B1120] border-slate-800 hover:border-emerald-500/40'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div aria-hidden="true" className={`shrink-0 w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                              isSelected 
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950 booking-check-pop' 
                                : 'border-slate-700 bg-slate-900 text-transparent'
                            }`}>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>

                            <div>
                              <h4 className={`font-bold text-xs sm:text-sm transition-colors ${
                                isSelected ? 'text-emerald-300' : 'text-white'
                              }`}>
                                {service.name}
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" /> {service.duration_minutes} min • {service.category}
                              </p>
                              {(service.badge || service.description) && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{service.badge ? <span className="mr-1 font-bold text-amber-200">{service.badge}:</span> : null}{service.description}</p>}
                            </div>
                          </div>

                          <span className={`shrink-0 whitespace-nowrap text-xs sm:text-sm font-bold font-mono px-2.5 py-1 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            R$ {service.price.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* BARRA DE RESUMO E AVANÇO */}
                  {selectedServices.length > 0 ? (
                    <div className="bg-[#0B1120] p-3.5 rounded-2xl border border-emerald-500/30 space-y-2.5 pt-3">
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-white text-xs">{selectedServices.length} serviço(s)</span>
                          <p className="text-[10px] text-slate-400">Tempo: {totalDuration} min</p>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 text-[9px] uppercase tracking-wider block">Total</span>
                          <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">R$ {totalPrice.toFixed(2)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => goToStep(3)}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-98"
                      >
                        Continuar para o Barbeiro
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-amber-400/90 py-2">
                      👆 Clique em um ou mais serviços acima para continuar.
                    </p>
                  )}
                </div>
              )}

              {/* ETAPA 3: BARBEIRO (ÍCONE DE PERFIL PADRÃO) */}
              {step === 3 && (
                <div key="step-3" data-booking-panel className="space-y-3.5 sm:space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs flex items-center justify-center font-bold">3</span>
                      Escolha o Profissional
                    </h2>
                    <button onClick={() => goToStep(2)} className="text-xs text-emerald-400 hover:underline">
                      Alterar ({selectedServices.length})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {activeBarbers.map((barber, index) => (
                      <div
                        key={barber.id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault(); setSelectedBarber(barber); goToStep(4);
                          }
                        }}
                        onClick={() => {
                          setSelectedBarber(barber);
                          goToStep(4);
                        }}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className="stagger-item booking-card p-3.5 rounded-2xl bg-[#0B1120] border border-slate-800 hover:border-emerald-500/50 cursor-pointer flex items-center gap-3 group"
                      >
                        <div className="transition-transform duration-200 group-hover:scale-105">
                          <BarberAvatar
                            name={barber.full_name}
                            avatarUrl={barber.avatar_url}
                            size="md"
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors text-xs sm:text-sm">{barber.full_name}</h4>
                          <p className="text-[11px] text-slate-400">{barber.role}</p>
                          {barber.bio && <p className="mt-2 text-xs text-slate-300 break-words">{barber.bio}</p>}
                          {!!barber.specialties?.length && <div className="mt-2 flex flex-wrap gap-1">{barber.specialties.map(specialty => <span key={specialty} className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">{specialty}</span>)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ETAPA 4: HORÁRIO (BLOQUEIO TOTAL DE HORÁRIOS OCUPADOS) */}
              {step === 4 && (
                <div key="step-4" data-booking-panel className="space-y-3.5 sm:space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs flex items-center justify-center font-bold">4</span>
                      Horário de Início
                    </h2>
                    <button onClick={() => goToStep(3)} className="text-xs text-emerald-400 hover:underline">
                      Alterar barbeiro
                    </button>
                  </div>

                  <div className="bg-[#0B1120] p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                    <span>Profissional: <strong className="text-white">{selectedBarber?.full_name}</strong></span>
                    <span className="text-emerald-400 font-medium">Duração: {totalDuration} min</span>
                  </div>

                  {selectedDateClosures.length > 0 && (
                    <div className={`rounded-2xl border p-3.5 flex items-start gap-2.5 ${selectedDateFullyClosed ? 'border-rose-400/30 bg-rose-400/10' : 'border-amber-400/30 bg-amber-400/10'}`}>
                      <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${selectedDateFullyClosed ? 'text-rose-300' : 'text-amber-300'}`} />
                      <div className="min-w-0">
                        <p className={`text-xs font-black ${selectedDateFullyClosed ? 'text-rose-200' : 'text-amber-200'}`}>
                          {selectedDateFullyClosed ? 'FECHADO NESTA DATA' : 'HORÁRIO ESPECIAL NESTA DATA'}
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {selectedDateClosures.map((period) => (
                            <p key={period.id} className="text-[11px] text-slate-200 leading-relaxed">
                              {period.all_day
                                ? `${period.reason || 'Não haverá atendimento'} neste dia.`
                                : `${selectedDate === bookingWindow.todayKey ? 'Hoje' : 'Neste dia'} não haverá atendimento das ${period.start || '--:--'} às ${period.end || '--:--'}.${period.reason ? ` ${period.reason}.` : ''}`}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Dia: <strong className="text-emerald-400">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong>
                    </span>
                    <span className="flex items-center gap-2 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Livre</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600"></span> Ocupado</span>
                    </span>
                  </div>

                  {selectedDateFullyClosed ? (
                    <div className="rounded-2xl border border-rose-800/50 bg-rose-950/20 p-6 text-center">
                      <Lock className="w-7 h-7 text-rose-300 mx-auto" />
                      <p className="text-sm font-black text-white mt-2">Estabelecimento fechado nesta data</p>
                      <p className="text-[11px] text-slate-400 mt-1">Escolha outra data para visualizar os horários disponíveis.</p>
                      <button type="button" onClick={() => goToStep(1)} className="mt-3 px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700">Escolher outra data</button>
                    </div>
                  ) : (
                    <>
                    {visibleTimeSlots.length === 0 ? (
                      <div className="rounded-2xl border border-slate-800 bg-[#0B1120]/60 p-6 text-center">
                        <Clock className="w-7 h-7 text-slate-500 mx-auto" />
                        <p className="text-sm font-black text-white mt-2">Não há mais horários disponíveis hoje</p>
                        <p className="text-[11px] text-slate-400 mt-1">Os horários que já passaram são ocultados automaticamente. Escolha outra data para continuar.</p>
                        <button type="button" onClick={() => goToStep(1)} className="mt-3 px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700">Escolher outra data</button>
                      </div>
                    ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1 booking-scroll">
                      {visibleTimeSlots.map((time, index) => {
                        const isOccupied = isTimeSlotOccupied(
                          time,
                          totalDuration,
                          selectedBarber?.id || '',
                          selectedDate,
                          appointments
                        );
                        const isOutsideBusinessTime = !isBookableBusinessTime(time, totalDuration, org);
                        const isExceptionalClosure = overlapsBusinessClosure(time, totalDuration, selectedDate, org);
                        const isUnavailable = isOccupied || isOutsideBusinessTime || isExceptionalClosure;

                        return (
                          <button
                            key={time}
                            type="button"
                            disabled={isUnavailable}
                            onClick={() => {
                              setSelectedTime(time);
                              setBookingError('');
                              goToStep(5);
                            }}
                            style={{ animationDelay: `${Math.min(index, 16) * 20}ms` }}
                            className={`stagger-item py-2.5 px-2 rounded-xl font-mono text-xs font-bold border transition-all duration-150 flex items-center justify-center gap-1 ${
                              isExceptionalClosure
                                ? 'bg-amber-950/20 text-amber-700 border-amber-900/30 cursor-not-allowed line-through opacity-70 shadow-inner'
                                : isUnavailable
                                  ? 'bg-[#0B1120]/40 text-slate-600 border-slate-900/80 cursor-not-allowed line-through opacity-50 shadow-inner'
                                  : 'bg-[#0B1120] text-emerald-400 border-slate-800 hover:border-emerald-500 hover:bg-emerald-500/10 hover:-translate-y-0.5 cursor-pointer active:scale-95'
                            }`}
                            title={isExceptionalClosure ? 'Estabelecimento fechado neste período' : isOutsideBusinessTime ? 'Fora do expediente ou período de descanso' : isOccupied ? 'Horário indisponível' : 'Horário livre'}
                          >
                            {isUnavailable && <Lock className={`w-3 h-3 shrink-0 ${isExceptionalClosure ? 'text-amber-600' : 'text-slate-600'}`} />}
                            <span>{time}</span>
                          </button>
                        );
                      })}
                    </div>
                    )}
                    </>
                  )}

                  {/* CARD DE CONVITE PARA A LISTA DE ESPERA RELÂMPAGO */}
                  <div className="public-waitlist-invite-card mt-4 p-3.5 sm:p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="waitlist-invite-icon w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 shadow-sm">
                        <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <p className="waitlist-invite-title text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                          Não encontrou seu horário ideal?
                          <span className="waitlist-invite-tag text-[9px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-extrabold border border-amber-400/30">
                            VAGA RELÂMPAGO
                          </span>
                        </p>
                        <p className="waitlist-invite-text text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                          Entre na nossa Fila de Espera: se alguém desmarcar, avisamos você imediatamente no WhatsApp!
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWaitlistModal(true)}
                      className="waitlist-invite-btn w-full sm:w-auto px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all shadow-md active:scale-95 shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                      Entrar na Fila
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 5: DADOS DE CONTATO DO CLIENTE */}
              {step === 5 && (
                <form onSubmit={handleFinishBooking} key="step-5" data-booking-panel className="space-y-3.5 sm:space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs flex items-center justify-center font-bold">5</span>
                      Seus Dados de Contato
                    </h2>
                    <button type="button" onClick={() => goToStep(4)} className="text-xs text-emerald-400 hover:underline">
                      Alterar horário
                    </button>
                  </div>

                  {/* Resumo dos Serviços Escolhidos */}
                  <div className="bg-[#0B1120] p-3.5 rounded-2xl border border-slate-800 text-xs space-y-2 text-slate-300">
                    <p><span className="text-slate-500">Profissional:</span> <strong className="text-white">{selectedBarber?.full_name}</strong></p>
                    <p><span className="text-slate-500">Data e Horário:</span> <strong className="text-emerald-400 font-mono">{selectedTime}</strong> no dia {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>

                    <div className="border-t border-slate-800/80 pt-1.5 space-y-1">
                      <span className="text-slate-400 font-semibold block">Serviços Inclusos ({selectedServices.length}):</span>
                      {selectedServices.map(s => (
                        <div key={s.id} className="flex justify-between text-xs py-0.5">
                          <span className="text-white">• {s.name} ({s.duration_minutes} min)</span>
                          <span className="text-emerald-400 font-mono font-bold">R$ {s.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between border-t border-slate-800/80 pt-1.5 font-bold">
                      <span className="text-slate-300">Total ({totalDuration} min):</span>
                      <span className="text-emerald-400 font-mono text-sm">R$ {totalPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="tenantbooking-field-1" className="block text-xs font-semibold text-slate-300 mb-1">
                      Seu Nome Completo *
                    </label>
                    <input id="tenantbooking-field-1"
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ex: Carlos Eduardo"
                      className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="tenantbooking-field-2" className="block text-xs font-semibold text-slate-300 mb-1">
                      Seu WhatsApp (com DDD) *
                    </label>
                    <input id="tenantbooking-field-2"
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="(84) 99999-0000"
                      className="w-full bg-[#0B1120] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <TurnstileWidget ref={bookingTurnstileRef} action="public_booking" onTokenChange={handleBookingTurnstileToken} />

                  <ActionButton
                    type="submit"
                    status={bookingButtonStatus}
                    loadingLabel="Confirmando no sistema..."
                    successLabel="Agendamento confirmado"
                    icon={<MessageSquare className="w-4 h-4 fill-slate-950" />}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 text-sm mt-1 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0"
                  >
                    {`Confirmar Agendamento (R$ ${totalPrice.toFixed(2)})`}
                  </ActionButton>
                </form>
              )}
            </div>
          )}

          <div className="mt-4 rounded-2xl bg-slate-950/30 border border-slate-800/70 px-4 py-4">
            <AgencyCredit centered />
          </div>
        </div>
      </div>

      <PublicWaitlistModal
        open={showWaitlistModal}
        onClose={() => setShowWaitlistModal(false)}
        org={org}
        selectedDate={selectedDate}
        selectedBarber={selectedBarber}
        selectedServices={selectedServices}
        barbers={activeBarbers}
        services={activeServices}
        initialClientName={clientName}
        initialClientPhone={clientPhone}
        onSuccess={(entry) => onAddWaitlist?.(entry)}
      />
    </div>
  );
};
