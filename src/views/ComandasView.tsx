import { appConfirm } from '../components/common/ConfirmDialog';
import React, { useMemo, useState } from 'react';
import { Banknote, Check, ClipboardList, CreditCard, Minus, Package, Plus, QrCode, Search, ShoppingBag, Trash2, UserRound, X } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import type { Barber, Client, CommandProductItem, CommandServiceItem, Organization, Product, Service, ServiceCommand } from '../types';

type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash';

interface Props {
  org: Organization;
  commands: ServiceCommand[];
  setCommands: React.Dispatch<React.SetStateAction<ServiceCommand[]>>;
  services: Service[];
  products: Product[];
  clients: Client[];
  barbers: Barber[];
  onCloseCommand: (command: ServiceCommand) => void;
}

const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const commandTotal = (command: Pick<ServiceCommand, 'service_items' | 'product_items'>) =>
  command.service_items.reduce((sum, item) => sum + Number(item.price || 0), 0)
  + command.product_items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

const paymentOptions: Array<{ id: PaymentMethod; label: string; Icon: typeof QrCode }> = [
  { id: 'pix', label: 'Pix', Icon: QrCode },
  { id: 'cash', label: 'Dinheiro', Icon: Banknote },
  { id: 'credit', label: 'Crédito', Icon: CreditCard },
  { id: 'debit', label: 'Débito', Icon: CreditCard },
];

export function ComandasView({ org, commands, setCommands, services, products, clients, barbers, onCloseCommand }: Props) {
  const [editing, setEditing] = useState<ServiceCommand | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [barberId, setBarberId] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceItems, setServiceItems] = useState<CommandServiceItem[]>([]);
  const [productItems, setProductItems] = useState<CommandProductItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('pix');

  const visibleCommands = useMemo(() => commands
    .filter(command => showHistory ? command.status !== 'open' : command.status === 'open')
    .filter(command => `${command.client_name} ${command.client_phone || ''} ${command.barber_name || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => String(b.opened_at).localeCompare(String(a.opened_at))), [commands, query, showHistory]);
  const activeServices = useMemo(() => services.filter(item => item.active !== false), [services]);
  const activeProducts = useMemo(() => products.filter(item => item.active !== false && Number(item.stock || 0) > 0), [products]);
  const total = commandTotal({ service_items: serviceItems, product_items: productItems });

  const startNew = () => {
    setEditing(null); setClientName(''); setClientPhone(''); setBarberId(barbers.find(item => item.active !== false)?.id || '');
    setNotes(''); setServiceItems([]); setProductItems([]); setPayment('pix'); setIsEditorOpen(true);
  };
  const openEditor = (command: ServiceCommand) => {
    setEditing(command); setClientName(command.client_name); setClientPhone(command.client_phone || ''); setBarberId(command.barber_id || '');
    setNotes(command.notes || ''); setServiceItems(command.service_items); setProductItems(command.product_items); setPayment(command.payment_method || 'pix'); setIsEditorOpen(true);
  };
  const addService = (service: Service) => setServiceItems(current => current.some(item => item.service_id === service.id) ? current : [...current, { service_id: service.id, name: service.name, price: Number(service.price || 0), duration_minutes: Number(service.duration_minutes || 30) }]);
  const changeProduct = (product: Product, delta: number) => setProductItems(current => {
    const found = current.find(item => item.product_id === product.id);
    const nextQuantity = Math.max(0, Math.min(Number(product.stock || 0), Number(found?.quantity || 0) + delta));
    if (!nextQuantity) return current.filter(item => item.product_id !== product.id);
    const item: CommandProductItem = { product_id: product.id, name: product.name, price: Number(product.price || 0), cost: Number(product.cost || 0), quantity: nextQuantity };
    return found ? current.map(currentItem => currentItem.product_id === product.id ? item : currentItem) : [...current, item];
  });
  const saveDraft = () => {
    if (!clientName.trim()) return;
    const barber = barbers.find(item => item.id === barberId);
    const now = new Date().toISOString();
    const command: ServiceCommand = {
      id: editing?.id || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      org_id: org.id, status: 'open', client_name: clientName.trim(), client_phone: clientPhone.trim() || undefined,
      barber_id: barber?.id, barber_name: barber?.full_name, notes: notes.trim() || undefined, service_items: serviceItems,
      product_items: productItems, payment_method: payment, opened_at: editing?.opened_at || now,
    };
    setCommands(current => editing ? current.map(item => item.id === editing.id ? command : item) : [command, ...current]);
    setEditing(null); setIsEditorOpen(false);
  };
  const close = () => {
    if (!editing || total <= 0) return;
    onCloseCommand({ ...editing, client_name: clientName.trim(), client_phone: clientPhone.trim() || undefined, service_items: serviceItems, product_items: productItems, payment_method: payment, notes: notes.trim() || undefined, status: 'closed', closed_at: new Date().toISOString() });
    setEditing(null); setIsEditorOpen(false);
  };
  const cancel = async (command: ServiceCommand) => {
    if (!await appConfirm(`Cancelar a comanda de ${command.client_name}?`, { danger: true })) return;
    setCommands(current => current.map(item => item.id === command.id ? { ...item, status: 'canceled', canceled_at: new Date().toISOString() } : item));
  };

  return <div className="app-view space-y-6 animate-fadeIn">
    <header className="rounded-3xl border border-slate-800 bg-[#121B2E] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
      <div><h2 className="text-xl sm:text-2xl font-black text-white flex gap-2.5 items-center"><ClipboardList className="w-6 h-6 text-emerald-400" />Comandas</h2><p className="text-xs sm:text-sm text-slate-400 mt-1">Serviços e produtos em uma única conta, pronta para fechar no caixa.</p></div>
      <button onClick={startNew} className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Nova comanda</button>
    </header>
    <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4"><p className="text-[10px] uppercase tracking-widest text-slate-400">Abertas</p><p className="text-2xl font-black text-amber-300 font-mono">{commands.filter(item => item.status === 'open').length}</p></div><div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4"><p className="text-[10px] uppercase tracking-widest text-slate-400">Em aberto</p><p className="text-2xl font-black text-emerald-300 font-mono">{money(commands.filter(item => item.status === 'open').reduce((sum, item) => sum + commandTotal(item), 0))}</p></div></div>
    <div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente ou profissional..." className="w-full rounded-xl border border-slate-800 bg-slate-950 px-10 py-3 text-sm text-white focus:outline-none focus:border-emerald-500" /></div><button onClick={() => setShowHistory(value => !value)} className="rounded-xl px-4 py-3 text-xs font-bold border border-slate-800 bg-slate-900 text-slate-300">{showHistory ? 'Ver abertas' : 'Ver histórico'}</button></div>
    <div className="grid xl:grid-cols-2 gap-4">{visibleCommands.map(command => <article key={command.id} className="rounded-3xl border border-slate-800 bg-[#121B2E] p-5 shadow-lg"><div className="flex gap-3 justify-between"><div className="min-w-0"><p className="font-black text-white flex items-center gap-2"><UserRound className="w-4 h-4 text-cyan-300" />{command.client_name}</p><p className="text-xs text-slate-500 mt-1">{command.barber_name || 'Profissional não informado'} · {new Date(command.opened_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p></div><span className={`text-[10px] uppercase tracking-wider h-fit rounded-full px-2 py-1 font-bold ${command.status === 'open' ? 'bg-amber-400/10 text-amber-300' : command.status === 'closed' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>{command.status === 'open' ? 'Aberta' : command.status === 'closed' ? 'Fechada' : 'Cancelada'}</span></div><div className="mt-4 space-y-1.5 text-xs text-slate-400">{command.service_items.map(item => <p key={item.service_id}>• {item.name}</p>)}{command.product_items.map(item => <p key={item.product_id}>• {item.quantity}× {item.name}</p>)}{!command.service_items.length && !command.product_items.length && <p>Sem itens adicionados.</p>}</div><div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between"><strong className="text-emerald-300 font-mono">{money(commandTotal(command))}</strong>{command.status === 'open' && <div className="flex gap-2"><button onClick={() => cancel(command)} className="p-2 rounded-lg text-rose-300 hover:bg-rose-500/10 min-w-[44px] min-h-[44px] inline-flex items-center justify-center" aria-label="Cancelar comanda"><Trash2 className="w-4 h-4" /></button><button onClick={() => openEditor(command)} className="rounded-lg px-3 py-2 bg-slate-800 text-white text-xs font-bold">Abrir</button></div>}</div></article>)}</div>
    {!visibleCommands.length && <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-500 text-sm">Nenhuma comanda {showHistory ? 'no histórico' : 'aberta'}.</div>}
    {isEditorOpen && <Modal label="Comanda" onClose={() => { setEditing(null); setClientName(''); setIsEditorOpen(false); }} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-hidden"><div className="modal-shell-fixed max-w-5xl w-full max-h-[92dvh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl"><div className="modal-static-header p-4 border-b border-slate-800 flex justify-between"><h3 className="font-black text-white">{editing ? 'Editar comanda' : 'Nova comanda'}</h3><button onClick={() => { setEditing(null); setClientName(''); setIsEditorOpen(false); }}><X className="w-5 h-5 text-slate-400" /></button></div><div className="modal-scroll-body p-4 grid lg:grid-cols-[.85fr_1fr_1fr] gap-5"><section className="space-y-3"><label className="text-xs font-bold text-slate-300">Cliente<input list="command-clients" value={clientName} onChange={event => { const found = clients.find(item => item.name.toLowerCase() === event.target.value.toLowerCase()); setClientName(event.target.value); if (found) setClientPhone(found.phone); }} placeholder="Nome do cliente" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label><datalist id="command-clients">{clients.map(client => <option key={client.id} value={client.name} />)}</datalist><label className="text-xs font-bold text-slate-300">WhatsApp<input value={clientPhone} onChange={event => setClientPhone(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="text-xs font-bold text-slate-300">Profissional<select value={barberId} onChange={event => setBarberId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"><option value="">Não informado</option>{barbers.filter(item => item.active !== false).map(barber => <option key={barber.id} value={barber.id}>{barber.full_name}</option>)}</select></label><label className="text-xs font-bold text-slate-300">Observações<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white resize-none" /></label></section><section><p className="text-xs uppercase tracking-wider font-bold text-cyan-300 mb-3">Serviços</p><div className="space-y-2 max-h-72 overflow-y-auto pr-1">{activeServices.map(service => <button key={service.id} onClick={() => addService(service)} className="w-full flex justify-between gap-3 text-left rounded-xl border border-slate-800 bg-slate-950/60 p-3 hover:border-cyan-400/40"><span className="text-sm font-bold text-white">{serviceItems.some(item => item.service_id === service.id) && <Check className="inline w-3.5 h-3.5 text-emerald-300 mr-1" />}{service.name}</span><span className="text-xs text-emerald-300 font-mono">{money(service.price)}</span></button>)}</div></section><section><p className="text-xs uppercase tracking-wider font-bold text-cyan-300 mb-3">Produtos</p><div className="space-y-2 max-h-72 overflow-y-auto pr-1">{activeProducts.map(product => { const quantity = productItems.find(item => item.product_id === product.id)?.quantity || 0; return <div key={product.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="flex justify-between gap-2"><span className="text-sm font-bold text-white">{product.name}</span><span className="text-xs text-emerald-300 font-mono">{money(product.price)}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-slate-500">{product.stock} em estoque</span><div className="flex items-center gap-2"><button onClick={() => changeProduct(product, -1)} disabled={!quantity} className="p-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-30 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button><span className="w-5 text-center font-mono text-white text-xs">{quantity}</span><button onClick={() => changeProduct(product, 1)} disabled={quantity >= product.stock} className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 disabled:opacity-30 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button></div></div></div>; })}</div></section></div><div className="modal-static-footer p-4 border-t border-slate-800"><div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between"><div><p className="text-[10px] uppercase tracking-wider text-slate-400">Total da comanda</p><p className="font-black text-xl text-emerald-300 font-mono">{money(total)}</p></div><div className="grid grid-cols-4 gap-1.5">{paymentOptions.map(({ id, label, Icon }) => <button key={id} onClick={() => setPayment(id)} className={`rounded-lg px-2 py-2 text-[10px] font-bold ${payment === id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}><Icon className="w-3.5 h-3.5 mx-auto mb-0.5" />{label}</button>)}</div><div className="flex gap-2"><button onClick={saveDraft} disabled={!clientName.trim()} className="rounded-xl bg-slate-700 px-4 py-3 text-xs font-bold text-white disabled:opacity-40">Salvar aberta</button>{editing && <button onClick={close} disabled={total <= 0 || !clientName.trim()} className="rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-40">Fechar e receber</button>}</div></div></div></div></Modal>}
  </div>;
}
