const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export type Product = {
  id: number;
  name: string;
  description?: string;
  price: number | string;
  discount?: number | string;
  brand?: string;
  status?: string;
  images?: { id: number; image_url: string; is_primary: boolean }[];
  variants?: {
    id: number;
    sku: string;
    size?: string;
    color?: string;
    price?: number | string;
    stock_quantity: number;
    status?: string;
  }[];
};

const demoProducts: Product[] = [
  ["Tailored Oxford Shirt",2299,5,"Men","White / Blue","https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1200&q=80"],
  ["Linen Overshirt",3199,10,"Men","Beige / Olive","https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80"],
  ["Pleated Formal Trousers",2899,0,"Men","Black / Grey","https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1200&q=80"],
  ["Minimalist Blazer",5999,15,"Men","Black / Charcoal","https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=1200&q=80"],
  ["Textured Knit Polo",2599,5,"Men","Navy / Cream","https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80"],
  ["Satin Midi Dress",3999,10,"Women","Ivory / Black","https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80"],
  ["Tailored Wide-Leg Pants",2999,5,"Women","Beige / Black","https://images.unsplash.com/photo-1506629905607-d9c297d2d4c0?auto=format&fit=crop&w=1200&q=80"],
  ["Silk Blend Blouse",2799,0,"Women","Cream / Black","https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=1200&q=80"],
  ["Structured Midi Skirt",2499,10,"Women","Black / Olive","https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=80"],
  ["Classic Trench Coat",5499,20,"Women","Beige / Black","https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1200&q=80"]
].map(([name,price,discount,category,colors,image],i) => ({
  id: 9000+i,
  name: String(name),
  description: "A refined demo piece from the current classy test collection.",
  price: Number(price),
  discount: Number(discount),
  brand: "DEMO COLLECTION",
  status: "active",
  images: [{id: 90000+i, image_url: String(image), is_primary: true}],
  variants: String(colors).split(" / ").flatMap((color,ci) =>
    ["S","M","L"].map((size,si)=>({
      id: 91000+i*10+ci*3+si,
      sku: `DEMO-${i+1}-${ci+1}-${size}`,
      size,
      color,
      price: Number(price),
      stock_quantity: 8+si,
      status: "active"
    }))
  )
}));

async function request<T>(path:string, options?:RequestInit):Promise<T>{
  const r=await fetch(API_URL+path,{headers:{"Content-Type":"application/json",...(options?.headers||{})},...options});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.message||`Request failed (${r.status})`);
  return d;
}

const demoCartKey = "demoCart";
const demoOrderKey = "demoOrder";

function demoCart(){
  return JSON.parse(localStorage.getItem(demoCartKey)||JSON.stringify({id:"demo-cart",items:[],subtotal:0}));
}
function saveDemoCart(cart:any){
  cart.subtotal = cart.items.reduce((s:any,x:any)=>s+Number(x.unit_price)*x.quantity,0);
  localStorage.setItem(demoCartKey,JSON.stringify(cart));
  return cart;
}

export const api = {
  url: API_URL,
  getProducts: async (q="") => {
    try { return await request<{success:boolean;data:Product[]}>(`/products${q?`?${q}`:""}`); }
    catch {
      const p=new URLSearchParams(q);
      let data=[...demoProducts];
      const search=(p.get("search")||"").toLowerCase(), cat=p.get("category")||"", sort=p.get("sort")||"newest";
      if(search) data=data.filter(x=>x.name.toLowerCase().includes(search)||x.description?.toLowerCase().includes(search));
      if(cat) data=data.filter(x=>x.variants?.some(v=>cat==="Men" ? ["S","M","L"].includes(v.size||"") : true) || (cat==="Men" ? x.id<9005 : x.id>=9005));
      if(sort==="price_low") data.sort((a,b)=>Number(a.price)-Number(b.price));
      if(sort==="price_high") data.sort((a,b)=>Number(b.price)-Number(a.price));
      if(sort==="name") data.sort((a,b)=>a.name.localeCompare(b.name));
      if(sort==="discount") data.sort((a,b)=>Number(b.discount)-Number(a.discount));
      return {success:true,data};
    }
  },
  getProduct: async (id:number) => {
    try { return await request<{success:boolean;data:Product}>(`/products/${id}`); }
    catch {
      const p=demoProducts.find(x=>x.id===id);
      if(!p) throw new Error("Product not found");
      return {success:true,data:p};
    }
  },
  createCart: async () => {
    try { return await request<{success:boolean;data:any}>("/cart",{method:"POST",body:"{}"}); }
    catch { return {success:true,data:{id:"demo-cart"}}; }
  },
  getCart: async (id:string) => {
    try { return await request<{success:boolean;data:any}>(`/cart/${id}`); }
    catch { return {success:true,data:demoCart()}; }
  },
  addCartItem: async (c:string,p:number,v:number|null,q:number) => {
    try { return await request<{success:boolean;data:any}>(`/cart/${c}/items`,{method:"POST",body:JSON.stringify({productId:p,variantId:v,quantity:q})}); }
    catch {
      const product=demoProducts.find(x=>x.id===p);
      const variant=product?.variants?.find(x=>x.id===v) || product?.variants?.[0];
      if(!product||!variant) throw new Error("Demo product variant not found");
      const cart=demoCart();
      const existing=cart.items.find((x:any)=>x.variant_id===variant.id);
      if(existing) existing.quantity+=q;
      else cart.items.push({id:Date.now(),product_id:p,variant_id:variant.id,product_name:product.name,unit_price:variant.price||product.price,quantity:q,size:variant.size,color:variant.color});
      return {success:true,data:saveDemoCart(cart)};
    }
  },
  deleteCartItem: async (c:string,i:number) => {
    try { return await request<{success:boolean;data:any}>(`/cart/${c}/items/${i}`,{method:"DELETE"}); }
    catch { const cart=demoCart(); cart.items=cart.items.filter((x:any)=>x.id!==i); return {success:true,data:saveDemoCart(cart)}; }
  },
  createOrder: async (b:any) => {
    try { return await request<{success:boolean;data:any}>("/orders",{method:"POST",body:JSON.stringify(b)}); }
    catch {
      const orderNumber=`DEMO-${Date.now().toString().slice(-8)}`;
      const cart=demoCart();
      const order={orderNumber,email:b.customerEmail,customerName:b.customerName,totalAmount:cart.subtotal,orderStatus:"pending",paymentStatus:"pending",items:cart.items};
      localStorage.setItem(demoOrderKey,JSON.stringify(order));
      localStorage.removeItem(demoCartKey);
      return {success:true,data:order};
    }
  },
  trackOrder: async (n:string,e:string) => {
    try { return await request<{success:boolean;data:any}>("/orders/track",{method:"POST",body:JSON.stringify({orderNumber:n,email:e})}); }
    catch {
      const order=JSON.parse(localStorage.getItem(demoOrderKey)||"null");
      if(order&&order.orderNumber===n&&order.email===e) return {success:true,data:order};
      throw new Error("Demo order not found on this device");
    }
  },
  adminLogin:(e:string,p:string)=>request<{success:boolean;data:{token:string;admin:any}}>("/auth/admin/login",{method:"POST",body:JSON.stringify({email:e,password:p})}),
  adminProducts:(t:string)=>request<{success:boolean;data:any[]}>("/admin/products",{headers:{Authorization:`Bearer ${t}`}}),
  adminOrders:(t:string)=>request<{success:boolean;data:any[]}>("/admin/orders",{headers:{Authorization:`Bearer ${t}`}}),
  adminInventory:(t:string)=>request<{success:boolean;data:any[]}>("/admin/inventory",{headers:{Authorization:`Bearer ${t}`}})
};
