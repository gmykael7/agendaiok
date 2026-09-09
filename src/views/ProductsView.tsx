import { Modal } from "../components/common/Modal";
import React, { useMemo, useState } from 'react';
import {
  Boxes,
  PackagePlus,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Pencil,
  X,
  Search,
  AlertTriangle,
  WalletCards,
  Globe2,
  CheckCircle2,
  Ban,
  PackageCheck,
  Banknote,
  QrCode,
  CreditCard,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { Organization, Product, ProductSale, ProductSaleItem } from '../types';

interface ProductsViewProps {
  org: Organization;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  productSales: ProductSale[];
  setProductSales: React.Dispatch<React.SetStateAction<ProductSale[]>>;
}

type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash';
type ViewMode = 'sell' | 'catalog' | 'orders';

const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const localTime = (date = new Date()) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

export const ProductsView: React.FC<ProductsViewProps> = ({
  org,
  products,
  setProducts,
  productSales,
  setProductSales,
}) => {
  const [mode, setMode] = useState<ViewMode>('sell');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [catalogModal, setCatalogModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [orderPayments, setOrderPayments] = useState<Record<string, PaymentMethod>>({});

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('0');
  const [category, setCategory] = useState('Finalizadores');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [active, setActive] = useState(true);
  const [publicVisible, setPublicVisible] = useState(true);

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);
  const today = localDateKey();
  const completedToday = useMemo(() => productSales.filter((sale) => sale.status === 'completed' && sale.date === today), [productSales, today]);
  const pendingOrders = useMemo(() => productSales.filter((sale) => sale.origin === 'public' && sale.status === 'pending').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), [productSales]);
  const lowStockCount = products.filter((p) => p.active !== false && Number(p.stock || 0) <= 3).length;
  const todayRevenue = completedToday.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeProducts;
    return activeProducts.filter((product) => `${product.name} ${product.category} ${product.sku || ''}`.toLowerCase().includes(q));
  }, [activeProducts, query]);

  const cartItems = useMemo<ProductSaleItem[]>(() => Object.entries(cart)
    .map(([productId, quantity]) => {
      const product = products.find((item) => item.id === productId);
      if (!product || quantity <= 0) return null;
      return {
        product_id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        quantity,
        cost: Number(product.cost || 0),
      } as ProductSaleItem;
    })
    .filter(Boolean) as ProductSaleItem[], [cart, products]);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const changeCart = (product: Product, delta: number) => {
    setCart((current) => {
      const nextQty = Math.max(0, Math.min(Number(product.stock || 0), Number(current[product.id] || 0) + delta));
      const next = { ...current };
      if (nextQty <= 0) delete next[product.id];
      else next[product.id] = nextQty;
      return next;
    });
  };

  const finalizeSale = () => {
    if (cartItems.length === 0) return;
    const insufficient = cartItems.find((item) => Number(products.find((p) => p.id === item.product_id)?.stock || 0) < item.quantity);
    if (insufficient) return alert(`Estoque insuficiente para ${insufficient.name}.`);

    const now = new Date();
    const sale: ProductSale = {
      id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      org_id: org.id,
      origin: 'internal',
      status: 'completed',
      items: cartItems,
      total: cartTotal,
      customer_name: customerName.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      payment_method: paymentMethod,
      date: localDateKey(now),
      time: localTime(now),
      created_at: now.toISOString(),
      completed_at: now.toISOString(),
    };

    setProducts((current) => current.map((product) => {
      const sold = cartItems.find((item) => item.product_id === product.id);
      return sold ? { ...product, stock: Math.max(0, Number(product.stock || 0) - sold.quantity) } : product;
    }));
    setProductSales((current) => [sale, ...current]);
    setCart({});
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('pix');
  };

  const openNewProduct = () => {
    setEditing(null);
    setName(''); setDescription(''); setPrice(''); setCost(''); setStock('0'); setCategory('Finalizadores'); setSku(''); setImageUrl(''); setActive(true); setPublicVisible(true);
    setCatalogModal(true);
  };

  const openEditProduct = (product: Product) => {
    setEditing(product);
    setName(product.name); setDescription(product.description || ''); setPrice(String(product.price)); setCost(product.cost ? String(product.cost) : ''); setStock(String(product.stock || 0)); setCategory(product.category || 'Geral'); setSku(product.sku || ''); setImageUrl(product.image_url || ''); setActive(product.active !== false); setPublicVisible(product.public_visible !== false);
    setCatalogModal(true);
  };

  const saveProduct = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedPrice = Number(price.replace(',', '.'));
    const parsedCost = Number(cost.replace(',', '.'));
    const parsedStock = Math.max(0, Math.floor(Number(stock || 0)));
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) return;

    if (editing) {
      setProducts((current) => current.map((product) => product.id === editing.id ? {
        ...product,
        name: name.trim(), description: description.trim() || undefined, price: parsedPrice,
        cost: Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : undefined,
        stock: parsedStock, category: category.trim() || 'Geral', sku: sku.trim() || undefined,
        image_url: imageUrl.trim() || undefined, active, public_visible: publicVisible,
      } : product));
    } else {
      setProducts((current) => [{
        id: `prd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        org_id: org.id,
        name: name.trim(), description: description.trim() || undefined, price: parsedPrice,
        cost: Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : undefined,
        stock: parsedStock, category: category.trim() || 'Geral', sku: sku.trim() || undefined,
        image_url: imageUrl.trim() || undefined, active, public_visible: publicVisible,
      }, ...current]);
    }
    setCatalogModal(false);
  };

  const deleteProduct = (product: Product) => {
    if (!confirm(`Excluir o produto “${product.name}”? O histórico das vendas será preservado.`)) return;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setCart((current) => { const next = { ...current }; delete next[product.id]; return next; });
  };

  const completePublicOrder = (sale: ProductSale) => {
    const method = orderPayments[sale.id] || sale.payment_method || 'pix';
    const nowIso = new Date().toISOString();
    setProductSales((current) => current.map((item) => item.id === sale.id ? { ...item, status: 'completed', payment_method: method, completed_at: nowIso } : item));
  };

  const cancelPublicOrder = (sale: ProductSale) => {
    if (!confirm('Cancelar este pedido e devolver os itens ao estoque?')) return;
    setProducts((current) => current.map((product) => {
      const reserved = sale.items.find((item) => item.product_id === product.id);
      return reserved ? { ...product, stock: Number(product.stock || 0) + reserved.quantity } : product;
    }));
    setProductSales((current) => current.map((item) => item.id === sale.id ? { ...item, status: 'canceled', canceled_at: new Date().toISOString() } : item));
  };

  return (
    <div className="app-view space-y-6 animate-fadeIn">
      <div className="rounded-3xl border border-slate-800 bg-[#121B2E] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5"><Boxes className="w-6 h-6 text-emerald-400" />Produtos Físicos & Estoque</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Venda no balcão, controle estoque e publique sua vitrine no site do cliente. Serviços continuam separados.</p>
        </div>
        <button onClick={openNewProduct} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 active:scale-95"><PackagePlus className="w-4 h-4" />Novo produto</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stagger-item booking-card rounded-2xl border border-slate-800 bg-slate-950/45 p-4 sm:p-5 shadow-md"><p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Produtos ativos</p><p className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">{activeProducts.length}</p></div>
        <div className="stagger-item booking-card rounded-2xl border border-slate-800 bg-slate-950/45 p-4 sm:p-5 shadow-md" style={{ animationDelay: '30ms' }}><p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Estoque baixo</p><p className={`text-2xl sm:text-3xl font-black mt-1 font-mono ${lowStockCount ? 'text-amber-300' : 'text-emerald-300'}`}>{lowStockCount}</p></div>
        <div className="stagger-item booking-card rounded-2xl border border-slate-800 bg-slate-950/45 p-4 sm:p-5 shadow-md" style={{ animationDelay: '60ms' }}><p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Pedidos do site</p><p className="text-2xl sm:text-3xl font-black text-cyan-300 mt-1 font-mono">{pendingOrders.length}</p></div>
        <div className="stagger-item booking-card rounded-2xl border border-slate-800 bg-slate-950/45 p-4 sm:p-5 shadow-md" style={{ animationDelay: '90ms' }}><p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Vendas hoje</p><p className="text-xl sm:text-2xl font-black text-emerald-300 mt-1 font-mono">{money(todayRevenue)}</p></div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-[#121B2E] p-1.5 shadow-sm">
        {([
          ['sell', 'Venda rápida', ShoppingCart],
          ['catalog', 'Catálogo & estoque', Boxes],
          ['orders', `Pedidos do site${pendingOrders.length ? ` (${pendingOrders.length})` : ''}`, Globe2],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setMode(id)} className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 ${mode === id ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm' : 'text-slate-400 hover:text-white'}`}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </div>

      {mode === 'sell' && (
        <div className="grid xl:grid-cols-[1fr_360px] gap-5">
          <div className="rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar produto, categoria ou SKU" placeholder="Buscar produto, categoria ou SKU..." className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 shadow-sm" /></div>
            {filteredProducts.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Nenhum produto disponível para venda.</div> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">{filteredProducts.map((product, index) => {
                const qty = cart[product.id] || 0;
                const soldOut = Number(product.stock || 0) <= 0;
                return <div key={product.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }} className="stagger-item booking-card min-w-0 rounded-2xl border border-slate-800 bg-slate-950/45 p-2.5 sm:p-3.5 flex flex-col gap-2.5 sm:gap-3 shadow-sm hover:border-emerald-500/40 transition-all">
                  <div className="aspect-square sm:aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">{product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-700" />}</div>
                  <div className="min-w-0"><p className="text-[10px] text-cyan-300 uppercase tracking-wider truncate font-semibold">{product.category}</p><h3 className="font-bold text-white truncate mt-0.5 text-sm">{product.name}</h3><div className="flex justify-between items-center mt-2"><span className="text-emerald-400 font-black font-mono">{money(product.price)}</span><span className={`text-[10px] font-bold ${soldOut ? 'text-rose-300' : Number(product.stock) <= 3 ? 'text-amber-300' : 'text-slate-500'}`}>{soldOut ? 'Sem estoque' : `${product.stock} un.`}</span></div></div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 p-1"><button disabled={!qty} onClick={() => changeCart(product, -1)} className="w-8 h-8 rounded-lg text-slate-300 disabled:opacity-30 flex items-center justify-center hover:bg-slate-800 transition-colors"><Minus className="w-3.5 h-3.5" /></button><span className="font-black text-white font-mono text-xs">{qty}</span><button disabled={soldOut || qty >= Number(product.stock)} onClick={() => changeCart(product, 1)} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-300 disabled:opacity-30 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"><Plus className="w-3.5 h-3.5" /></button></div>
                </div>;
              })}</div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#121B2E] p-5 h-fit xl:sticky xl:top-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="font-black text-white flex items-center gap-2 text-sm"><ShoppingCart className="w-4 h-4 text-emerald-400" />Venda atual</h3><span className="text-xs text-slate-400 font-mono">{cartItems.reduce((s, i) => s + i.quantity, 0)} itens</span></div>
            {cartItems.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">Adicione produtos para registrar uma venda.</div> : <div className="space-y-2 max-h-52 overflow-y-auto pr-1">{cartItems.map((item) => <div key={item.product_id} className="flex justify-between gap-3 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-xs"><div><p className="font-bold text-white">{item.name}</p><p className="text-slate-500">{item.quantity} × {money(item.price)}</p></div><span className="font-black text-emerald-400 font-mono">{money(item.price * item.quantity)}</span></div>)}</div>}
            <div className="grid grid-cols-2 gap-2"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} aria-label="Nome do cliente (opcional)" placeholder="Cliente (opcional)" className="col-span-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" /><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} aria-label="WhatsApp do cliente (opcional)" placeholder="WhatsApp (opcional)" className="col-span-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" /></div>
            <div className="grid grid-cols-2 gap-2">{([
              ['pix', 'Pix', QrCode], ['cash', 'Dinheiro', Banknote], ['credit', 'Crédito', CreditCard], ['debit', 'Débito', WalletCards],
            ] as const).map(([id, label, Icon]) => <button key={id} onClick={() => setPaymentMethod(id)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 ${paymentMethod === id ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300 shadow-sm' : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-white'}`}><Icon className="w-4 h-4" />{label}</button>)}</div>
            <div className="border-t border-slate-800 pt-4 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Total</p><p className="text-2xl font-black text-emerald-400 font-mono">{money(cartTotal)}</p></div><button disabled={!cartItems.length} onClick={finalizeSale} className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black disabled:opacity-40 transition-all active:scale-95 shadow-sm">Finalizar venda</button></div>
          </div>
        </div>
      )}

      {mode === 'catalog' && (
        <div className="rounded-3xl border border-slate-800 bg-[#121B2E] p-4 sm:p-5 shadow-xl">
          {products.length === 0 ? <div className="p-10 text-center"><Boxes className="w-10 h-10 text-slate-700 mx-auto" /><p className="font-bold text-white mt-3">Nenhum produto cadastrado</p><button onClick={openNewProduct} className="mt-4 px-4 py-2.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black hover:bg-emerald-400 transition-all">Cadastrar primeiro produto</button></div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">{products.map((product, index) => <div key={product.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }} className={`stagger-item booking-card min-w-0 rounded-2xl border p-2.5 sm:p-4 shadow-sm transition-all ${product.active !== false ? 'border-slate-800 bg-slate-950/45 hover:border-emerald-500/40' : 'border-slate-900 bg-slate-950/25 opacity-60'}`}>
            <div className="flex gap-2.5 sm:gap-3"><div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">{product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <Boxes className="w-6 h-6 text-slate-700" />}</div><div className="min-w-0 flex-1"><p className="text-[9px] text-cyan-300 uppercase tracking-widest truncate font-semibold">{product.category}</p><h3 className="font-bold text-white truncate text-sm">{product.name}</h3><p className="text-emerald-400 font-mono font-black mt-1">{money(product.price)}</p></div></div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center"><div className="rounded-xl bg-slate-900/70 p-2"><p className="text-[9px] text-slate-400 font-semibold">Estoque</p><p className={`font-black font-mono text-xs ${Number(product.stock) <= 3 ? 'text-amber-300' : 'text-white'}`}>{product.stock}</p></div><div className="rounded-xl bg-slate-900/70 p-2"><p className="text-[9px] text-slate-400 font-semibold">Site</p><p className={`text-[10px] font-black ${product.public_visible !== false ? 'text-emerald-400' : 'text-slate-500'}`}>{product.public_visible !== false ? 'Visível' : 'Oculto'}</p></div><div className="rounded-xl bg-slate-900/70 p-2"><p className="text-[9px] text-slate-400 font-semibold">Status</p><p className={`text-[10px] font-black ${product.active !== false ? 'text-cyan-300' : 'text-slate-500'}`}>{product.active !== false ? 'Ativo' : 'Inativo'}</p></div></div>
            {Number(product.stock) <= 3 && product.active !== false && <p className="mt-3 text-[10px] text-amber-300 flex items-center gap-1.5 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />Estoque baixo</p>}
            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end gap-1.5"><button onClick={() => openEditProduct(product)} className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteProduct(product)} className="p-2 rounded-xl bg-rose-950/25 text-rose-300 hover:bg-rose-900/40 transition-colors"><Trash2 className="w-4 h-4" /></button></div>
          </div>)}</div>}
        </div>
      )}

      {mode === 'orders' && (
        <div className="space-y-3">
          {pendingOrders.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center"><Globe2 className="w-10 h-10 text-slate-700 mx-auto" /><p className="font-bold text-white mt-3">Nenhum pedido pendente do site</p><p className="text-xs text-slate-500 mt-1">Quando um cliente comprar na página pública, o pedido aparecerá aqui e o estoque será reservado.</p></div> : pendingOrders.map((sale) => <div key={sale.id} className="booking-card rounded-3xl border border-cyan-400/20 bg-[#121B2E] p-5 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="rounded-full bg-cyan-400/10 text-cyan-200 border border-cyan-400/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">Pedido do site</span><span className="text-[10px] text-slate-400 font-mono">{sale.date} • {sale.time}</span></div><h3 className="font-black text-white text-base mt-2">{sale.customer_name || 'Cliente'}</h3><p className="text-xs text-slate-400">{sale.customer_phone || 'Sem telefone'}</p></div><div className="text-left lg:text-right"><p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Total</p><p className="text-2xl font-black text-emerald-400 font-mono">{money(sale.total)}</p></div></div>
            <div className="mt-4 grid md:grid-cols-2 gap-2">{sale.items.map((item) => <div key={`${sale.id}-${item.product_id}`} className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2.5 flex justify-between text-xs"><span className="text-white">{item.quantity}× {item.name}</span><span className="font-mono text-slate-300">{money(item.price * item.quantity)}</span></div>)}</div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end"><select value={orderPayments[sale.id] || sale.payment_method || 'pix'} onChange={(e) => setOrderPayments((current) => ({ ...current, [sale.id]: e.target.value as PaymentMethod }))} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="credit">Crédito</option><option value="debit">Débito</option></select><button onClick={() => cancelPublicOrder(sale)} className="rounded-xl border border-rose-800/40 bg-rose-950/25 px-4 py-2 text-xs font-black text-rose-300 flex items-center justify-center gap-2 hover:bg-rose-900/40 transition-colors"><Ban className="w-4 h-4" />Cancelar</button><button onClick={() => completePublicOrder(sale)} className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"><PackageCheck className="w-4 h-4" />Concluir venda</button></div>
          </div>)}
        </div>
      )}

      {catalogModal && (
        <Modal label="Cadastro de produto" onClose={() => setCatalogModal(false)} className="fixed inset-0 z-[220] app-mobile-modal bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setCatalogModal(false); }}>
          <div className="modal-shell-fixed w-full sm:max-w-2xl max-h-[92dvh] rounded-3xl border border-slate-700 bg-[#0d1729] shadow-2xl">
            <div className="modal-static-header sticky top-0 z-10 bg-[#0d1729]/95 backdrop-blur-xl border-b border-slate-800 px-5 py-4 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Produto físico</p><h3 className="text-lg sm:text-xl font-black text-white mt-0.5">{editing ? 'Editar produto' : 'Novo produto'}</h3></div><button aria-label="Fechar janela" type="button" onClick={() => setCatalogModal(false)} className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button></div>
            <form onSubmit={saveProduct} className="flex min-h-0 flex-1 flex-col">
              <div className="modal-scroll-body p-5 grid sm:grid-cols-2 gap-4">
                <label className="sm:col-span-2 text-xs text-slate-300 font-semibold">Nome *<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pomada efeito matte" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500" /></label>
                <label className="text-xs text-slate-300 font-semibold">Preço de venda *<input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500" /></label>
                <label className="text-xs text-slate-300 font-semibold">Custo (opcional)<input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500" /></label>
                <label className="text-xs text-slate-300 font-semibold">Estoque<input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500" /></label>
                <label className="text-xs text-slate-300 font-semibold">Categoria<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Pomadas" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500" /></label>
                <label className="text-xs text-slate-300 font-semibold">SKU / Código<input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="POM-001" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500" /></label>
                <label className="text-xs text-slate-300 font-semibold">URL da foto<input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500" /></label>
                <label className="sm:col-span-2 text-xs text-slate-300 font-semibold">Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Descrição curta para a vitrine pública" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white resize-none focus:outline-none focus:border-emerald-500" /></label>
                <button type="button" onClick={() => setActive((value) => !value)} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-center justify-between"><span className="text-xs font-bold text-white">Produto ativo</span><span className={`w-10 h-5 rounded-full p-0.5 ${active ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className={`block w-4 h-4 bg-white rounded-full transition-transform ${active ? 'translate-x-5' : ''}`} /></span></button>
                <button type="button" onClick={() => setPublicVisible((value) => !value)} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-center justify-between"><span className="text-xs font-bold text-white">Mostrar no site público</span><span className={`w-10 h-5 rounded-full p-0.5 ${publicVisible ? 'bg-cyan-500' : 'bg-slate-700'}`}><span className={`block w-4 h-4 bg-white rounded-full transition-transform ${publicVisible ? 'translate-x-5' : ''}`} /></span></button>
              </div>
              <div className="modal-static-footer sticky bottom-0 bg-[#0d1729]/96 backdrop-blur-xl border-t border-slate-800 p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2 justify-end"><button type="button" onClick={() => setCatalogModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700">Cancelar</button><button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-sm active:scale-95"><CheckCircle2 className="w-4 h-4" />Salvar produto</button></div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
