import {useEffect,useState} from "react";
import type {FormEvent} from "react";
import {Link,Route,Routes,useLocation,useNavigate,useParams,useSearchParams} from "react-router-dom";
import {api,Product} from "./api";
import AdminPanel from "./admin/AdminPanel";

const money=(v:number|string)=>`₹${Number(v||0).toLocaleString("en-IN")}`;
const Icon=({type}:{type:"search"|"bag"|"user"|"arrow"})=>{
 const p={width:17,height:17,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.4};
 if(type==="search")return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
 if(type==="user")return <svg {...p}><circle cx="12" cy="7" r="4"/><path d="M4 21v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1"/></svg>;
 if(type==="arrow")return <svg {...p}><path d="M5 12h13M13 6l6 6-6 6"/></svg>;
 return <svg {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>;
};

function Header({count}:{count:number}){
 const [q,setQ]=useState("");const nav=useNavigate();
 return <header className="site-header"><div className="container header-main"><Link to="/" className="brand">DEMONSTATION</Link><div className="header-tools"><form className="search" onSubmit={e=>{e.preventDefault();if(q.trim())nav(`/products?search=${encodeURIComponent(q)}`)}}><Icon type="search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="SEARCH"/></form><Link to="/cart" className="tool"><Icon type="bag"/><span>BAG ({count})</span></Link></div></div><nav className="container ribbon"><Link to="/products">COLLECTIONS</Link><Link to="/products?gender=men">MEN</Link><Link to="/products?gender=women">WOMEN</Link><Link to="/products?sort=newest">NEW ARRIVALS</Link><Link to="/products?sort=discount">SALE</Link><Link to="/track">ORDER TRACKING</Link></nav></header>;
}

function Card({p,index}:{p:Product,index:number}){
 const img=p.images?.find(x=>x.is_primary)?.image_url||p.images?.[0]?.image_url;
 return <Link to={`/products/${p.id}`} className="product-card" style={{animationDelay:`${index*45}ms`}}><div className="product-image">{img?<img src={img} alt={p.name}/>:<span>IMAGE PENDING</span>}<i>{String(index+1).padStart(2,"0")}</i></div><div className="product-meta"><div><small>{p.brand||"COLLECTION"}</small><h3>{p.name}</h3></div><strong>{money(p.price)}</strong></div></Link>;
}

function Home(){
 const [products,setProducts]=useState<Product[]>([]);
 useEffect(()=>{void api.getProducts("limit=8&sort=newest").then(r=>setProducts(r.data||[])).catch(()=>{})},[]);
 return <main><section className="hero"><div className="hero-media">{products[0]?.images?.[0]?.image_url&&<img src={products[0].images[0].image_url} alt=""/>}</div><div className="hero-shade"/><div className="container hero-copy"><small>COLLECTION / 01 — NEW SEASON</small><h1>FORM<br/><em>IN MOTION.</em></h1><p>Quiet structure. Considered essentials. A contemporary collection built for everyday movement.</p><Link className="light-link" to="/products">EXPLORE COLLECTION <Icon type="arrow"/></Link></div><div className="hero-foot"><span>SCROLL TO EXPLORE</span><span>01 / 05</span></div></section><section className="container statement section"><small>01 / BRAND STATEMENT</small><div><h2>Designed with restraint.<br/><em>Built with purpose.</em></h2><p>Premium essentials shaped around clean silhouettes, honest materials and a quieter approach to modern fashion.</p></div></section><section className="section collection"><div className="container section-head"><div><small>02 / COLLECTION INDEX</small><h2>NEW ARRIVALS</h2></div><Link className="text-link" to="/products">VIEW ALL <Icon type="arrow"/></Link></div><div className="container product-grid">{products.slice(0,4).map((p,i)=><Card p={p} index={i} key={p.id}/>)}</div></section><section className="container section editorial"><div><small>03 / EDITORIAL</small><h2>THE EVERYDAY<br/><em>UNIFORM.</em></h2><p>A focused wardrobe where utility meets proportion and every detail earns its place.</p><Link className="text-link" to="/products">SHOP THE EDIT <Icon type="arrow"/></Link></div><div className="editorial-image">{products[1]?.images?.[0]?.image_url&&<img src={products[1].images[0].image_url} alt=""/>}</div></section></main>;
}

function Products(){
 const [params,setParams]=useSearchParams();const [items,setItems]=useState<Product[]>([]);const [error,setError]=useState("");const q=params.get("search")||"";const category=params.get("category")||"";const gender=params.get("gender")||"";const sort=params.get("sort")||"newest";
 const load=async()=>{try{setError("");const s=new URLSearchParams();if(q)s.set("search",q);if(category)s.set("category",category);if(gender)s.set("gender",gender);s.set("sort",sort);s.set("limit","50");setItems((await api.getProducts(s.toString())).data||[])}catch(e){setError(e instanceof Error?e.message:"Unable to load products")}};
 useEffect(()=>{void load()},[q,category,gender,sort]);
 return <main className="container section catalog"><div className="section-head"><div><small>CATALOG / ALL PIECES</small><h1>THE COLLECTION</h1></div><span>{items.length} PIECES</span></div><div className="catalog-tools"><form className="catalog-search" onSubmit={e=>{e.preventDefault();const v=(e.currentTarget.elements.namedItem("q") as HTMLInputElement).value;setParams(p=>{v?p.set("search",v):p.delete("search");return p})}}><Icon type="search"/><input name="q" defaultValue={q} placeholder="SEARCH COLLECTION"/></form><div className="filters">{[["","ALL"],["men","MEN"],["women","WOMEN"]].map(([x,label])=><button className={gender===x?"active":""} key={x||"all"} onClick={()=>setParams(p=>{x?p.set("gender",x):p.delete("gender");return p})}>{label}</button>)}<select value={sort} onChange={e=>setParams(p=>{p.set("sort",e.target.value);return p})}><option value="newest">NEWEST</option><option value="price_low">PRICE LOW</option><option value="price_high">PRICE HIGH</option><option value="name">NAME</option><option value="discount">DISCOUNT</option></select></div></div>{error&&<p className="error">{error}</p>}{items.length?<div className="product-grid">{items.map((p,i)=><Card p={p} index={i} key={p.id}/>)}</div>:<div className="empty">NO PRODUCTS FOUND</div>}</main>;
}

function ProductPage({refresh}:{refresh:()=>void}){
 const {id}=useParams();
 const [p,setP]=useState<Product|null>(null);
 const [size,setSize]=useState<string>("");
 const [color,setColor]=useState<string>("");
 const [msg,setMsg]=useState("");
 const [error,setError]=useState("");

 useEffect(()=>{
   if(id)void api.getProduct(Number(id)).then(r=>{
     const product=r.data;
     setP(product);
     const first=product.variants?.find(x=>Number(x.stock_quantity)>0);
     setSize(first?.size||"");
     setColor(first?.color||"");
   }).catch(e=>setError(e instanceof Error?e.message:"Unable to load product"));
 },[id]);

 if(error)return <main className="container section"><p className="error">{error}</p></main>;
 if(!p)return <main className="container section">LOADING...</main>;

 const img=p.images?.find(x=>x.is_primary)?.image_url||p.images?.[0]?.image_url;
 const variants=p.variants||[];
 const sizes=[...new Set(variants.map(x=>x.size).filter(Boolean))] as string[];
 const colors=[...new Set(variants.map(x=>x.color).filter(Boolean))] as string[];
 const selected=variants.find(x=>
   (!sizes.length||x.size===size) &&
   (!colors.length||x.color===color)
 );
 const available=selected && Number(selected.stock_quantity)>0;

 const chooseSize=(next:string)=>{
   setSize(next);
   const exact=variants.find(x=>x.size===next && (!color||x.color===color) && Number(x.stock_quantity)>0);
   if(exact&&exact.color)setColor(exact.color);
 };
 const chooseColor=(next:string)=>{
   setColor(next);
   const exact=variants.find(x=>x.color===next && (!size||x.size===size) && Number(x.stock_quantity)>0);
   if(exact&&exact.size)setSize(exact.size);
 };

 const add=async()=>{
   try{
     setError("");
     if(!selected||!available)throw Error("Please select an available size and color.");
     let c=localStorage.getItem("cartId");
     if(!c){
       const created=(await api.createCart()).data;
       c=String(created.id||"");
       if(!c)throw Error("Unable to create cart.");
       localStorage.setItem("cartId",c);
     }
     await api.addCartItem(c,p.id,selected.id,1);
     setMsg("ADDED TO BAG");
     refresh();
   }catch(e){
     setError(e instanceof Error?e.message:"Unable to add to cart");
   }
 };

 return <main className="container section detail">
   <div className="detail-image">{img&&<img src={img} alt={p.name}/>}</div>
   <div className="detail-copy">
     <small>{p.brand||"COLLECTION"} / PRODUCT {p.id}</small>
     <h1>{p.name}</h1>
     <div className="price">{money(selected?.price??p.price)}</div>
     <p>{p.description||"A considered essential from the current collection."}</p>

     {sizes.length>0&&<><label>SIZE</label><div className="variants">{sizes.map(s=>{
       const hasStock=variants.some(x=>x.size===s&&(!color||x.color===color)&&Number(x.stock_quantity)>0);
       return <button disabled={!hasStock} className={size===s?"active":""} key={s} onClick={()=>chooseSize(s)}>{s}</button>;
     })}</div></>}

     {colors.length>0&&<><label>COLOR</label><div className="variants">{colors.map(c=>{
       const hasStock=variants.some(x=>x.color===c&&(!size||x.size===size)&&Number(x.stock_quantity)>0);
       return <button disabled={!hasStock} className={color===c?"active":""} key={c} onClick={()=>chooseColor(c)}>{c}</button>;
     })}</div></>}

     <button className="add" disabled={!available} onClick={()=>void add()}>ADD TO BAG <Icon type="arrow"/></button>
     {msg&&<p className="success">{msg}</p>}
     {error&&<p className="error">{error}</p>}
     <div className="notes"><p><b>SHIPPING</b>Delivery calculated at checkout.</p><p><b>RETURNS</b>Subject to store policy.</p></div>
   </div>
 </main>;
}
function Cart(){
 const [cart,setCart]=useState<any>();const [error,setError]=useState("");
 const load=async()=>{const id=localStorage.getItem("cartId")||"demo-cart";try{const r=await api.getCart(id);setCart(r.data)}catch(e){setError(e instanceof Error?e.message:"Unable to load bag")}};
 useEffect(()=>{void load()},[]);
 const items=cart?.items||[];
 const remove=async(id:number)=>{try{setError("");await api.deleteCartItem(localStorage.getItem("cartId")||"demo-cart",id);await load()}catch(e){setError(e instanceof Error?e.message:"Unable to remove item")}};
 return <main className="container section narrow"><small>BAG / CURRENT SELECTION</small><h1>YOUR BAG</h1>{error&&<p className="error">{error}</p>}{!items.length?<div className="empty">YOUR BAG IS EMPTY <p><Link className="text-link" to="/products">EXPLORE COLLECTION <Icon type="arrow"/></Link></p></div>:<><div className="cart-list">{items.map((x:any)=><div className="cart-row" key={x.id}><div><b>{x.product_name||x.name||`PRODUCT #${x.product_id}`}</b><small>{[x.size,x.color].filter(Boolean).join(" · ")||"Standard"} · QTY {x.quantity}</small><button className="table-link" onClick={()=>void remove(x.id)}>REMOVE</button></div><strong>{money(Number(x.unit_price||x.price||0)*Number(x.quantity||1))}</strong></div>)}</div><div className="cart-total"><span>SUBTOTAL</span><b>{money(cart?.subtotal||items.reduce((s:number,x:any)=>s+Number(x.unit_price||x.price||0)*Number(x.quantity||1),0))}</b><p>{Number(cart?.subtotal||0)>=2000?"Free shipping":"Shipping ₹100 for orders under ₹2,000"}</p><Link className="add" to="/checkout">CONTINUE TO CHECKOUT <Icon type="arrow"/></Link></div></>}</main>;
}

function Checkout(){
 const nav=useNavigate();const [f,setF]=useState({customerName:"",customerEmail:"",customerPhone:"",shippingAddress:""});const [error,setError]=useState("");const [cart,setCart]=useState<any>();
 useEffect(()=>{void api.getCart(localStorage.getItem("cartId")||"demo-cart").then(r=>setCart(r.data)).catch(()=>setCart({items:[]}))},[]);
 const items=cart?.items||[];
 const subtotal=Number(cart?.subtotal||items.reduce((s:number,x:any)=>s+Number(x.unit_price||x.price||0)*Number(x.quantity||1),0));const shipping=subtotal>=2000?0:100;
 const submit=async(e:FormEvent)=>{e.preventDefault();try{setError("");if(!items.length)throw Error("Your bag is empty. Add a product before checkout.");if(!/^\\S+@\\S+\\.\\S+$/.test(f.customerEmail))throw Error("Enter a valid email address.");if(f.customerPhone.replace(/\\D/g,"").length<10)throw Error("Enter a valid phone number.");const r=await api.createOrder({cartId:localStorage.getItem("cartId")||"demo-cart",...f});nav("/confirmation",{state:r.data})}catch(x){setError(x instanceof Error?x.message:"Checkout failed")}};
 return <main className="container section narrow"><small>CHECKOUT / DELIVERY</small><h1>DELIVERY DETAILS</h1>{!items.length?<div className="empty">YOUR BAG IS EMPTY <p><Link className="text-link" to="/products">RETURN TO COLLECTION</Link></p></div>:<><div className="admin-card"><div className="admin-card-head"><h2>Order summary</h2></div>{items.map((x:any)=><p key={x.id}>{x.product_name||x.name} · {x.size||"One size"} · Qty {x.quantity} <strong>{money(Number(x.unit_price||x.price||0)*Number(x.quantity||1))}</strong></p>)}<hr/><p>Subtotal <strong>{money(subtotal)}</strong></p><p>Shipping <strong>{shipping===0?"FREE":money(shipping)}</strong></p><h3>Total <strong>{money(subtotal+shipping)}</strong></h3></div><form className="form" onSubmit={submit}><label>FULL NAME<input required maxLength={150} value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})}/></label><label>EMAIL ADDRESS<input required type="email" maxLength={255} value={f.customerEmail} onChange={e=>setF({...f,customerEmail:e.target.value})}/></label><label>PHONE NUMBER<input required type="tel" maxLength={30} value={f.customerPhone} onChange={e=>setF({...f,customerPhone:e.target.value})}/></label><label>SHIPPING ADDRESS<textarea required maxLength={1000} value={f.shippingAddress} onChange={e=>setF({...f,shippingAddress:e.target.value})}/></label><button className="add">PLACE DEMO ORDER <Icon type="arrow"/></button></form><p className="muted">Demo checkout only. No payment is collected and no real order is sent to a fulfilment service.</p></>}{error&&<p className="error">{error}</p>}</main>;
}

function Track(){const [n,setN]=useState(""),[e,setE]=useState(""),[r,setR]=useState<any>(),[err,setErr]=useState("");return <main className="container section narrow"><small>CLIENT SERVICE / ORDER STATUS</small><h1>TRACK ORDER</h1><form className="form" onSubmit={async x=>{x.preventDefault();try{setErr("");setR((await api.trackOrder(n.trim(),e.trim().toLowerCase())).data)}catch(z){setR(null);setErr(z instanceof Error?z.message:"Order not found")}}}><label>ORDER NUMBER<input required value={n} onChange={x=>setN(x.target.value)}/></label><label>EMAIL<input required type="email" value={e} onChange={x=>setE(x.target.value)}/></label><button className="add">TRACK ORDER <Icon type="arrow"/></button></form>{err&&<p className="error">{err}</p>}{r&&<div className="admin-card"><small>ORDER STATUS</small><h2>{r.orderNumber||r.order_number}</h2><p>Customer: {r.customerName||r.customer_name}</p><p>Status: <b>{r.orderStatus||r.order_status||"pending"}</b></p><p>Payment: {r.paymentStatus||r.payment_status||"pending"}</p><p>Total: <b>{money(r.totalAmount||r.total_amount||0)}</b></p><p>{(r.items||[]).length} item(s)</p></div>}</main>}

function Confirmation(){const location=useLocation();const order=(location.state||JSON.parse(localStorage.getItem("demoOrder")||"null")) as any;return <main className="container section confirmation"><small>ORDER / CONFIRMED</small><h1>THANK YOU.</h1><p>Your demo order has been created. No payment was collected.</p>{order&&<div className="admin-card"><h2>{order.orderNumber||order.order_number||"Order received"}</h2><p>Order total: <b>{money(order.totalAmount||order.total_amount||0)}</b></p><p>Status: {order.orderStatus||order.order_status||"pending"}</p><p>Keep your order number and email to try order tracking on this browser.</p><Link className="text-link" to="/track">TRACK THIS ORDER <Icon type="arrow"/></Link></div>}<Link className="text-link" to="/products">CONTINUE SHOPPING <Icon type="arrow"/></Link></main>}

function Admin(){return <AdminPanel/>;}

function Footer(){return <footer><div className="container footer-grid"><div><span className="brand">DEMONSTATION</span><p>Contemporary essentials. Designed with restraint.</p></div><div><small>SHOP</small><Link to="/products">Collection</Link><Link to="/track">Track Order</Link></div><div><small>SERVICE</small><span>Shipping & Delivery</span><span>Returns</span><span>Client Care</span></div></div><div className="container copyright">© {new Date().getFullYear()} DEMONSTATION / E-COMMERCE</div></footer>}

export default function App(){const location=useLocation();const [count,setCount]=useState(0);const refresh=async()=>{const id=localStorage.getItem("cartId");if(!id)return setCount(0);try{const r=await api.getCart(id);setCount((r.data?.items||[]).reduce((s:number,x:any)=>s+Number(x.quantity||0),0))}catch{setCount(0)}};useEffect(()=>{void refresh()},[]);return <><Header count={count}/><Routes><Route path="/" element={<Home/>}/><Route path="/products" element={<Products/>}/><Route path="/products/:id" element={<ProductPage refresh={refresh}/>}/><Route path="/cart" element={<Cart/>}/><Route path="/checkout" element={<Checkout/>}/><Route path="/track" element={<Track/>}/><Route path="/admin" element={<Admin/>}/><Route path="/confirmation" element={<Confirmation/>}/></Routes><Footer/></>}