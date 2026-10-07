export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export type Product = {
  id: number;
  name: string;
  description?: string;
  price: number | string;
  discount?: number | string;
  brand?: string;
  status?: string;
  category_name?: string;
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

export const demoProducts: Product[] = [
  ["Tailored Oxford Shirt",2299,5,"Men","White / Blue","https://kemptwear.com/cdn/shop/files/White_Ox_ghost_01_800x.jpg?v=1754654545"],
  ["Linen Overshirt",3199,10,"Men","Beige / Olive","https://www.havhokeren.dk/cdn/shop/files/2541454735-804_1-Photoroom.jpg?v=1747663675"],
  ["Pleated Formal Trousers",2899,0,"Men","Black / Grey","https://turnbullandasser.com/cdn/shop/files/tro029-ffbw02-c1_1000x.jpg?v=1706136343"],
  ["Minimalist Blazer",5999,15,"Men","Black / Charcoal","https://i8.amplience.net/i/manor/10004068014_01?fmt=auto&h=920&w=920"],
  ["Textured Knit Polo",2599,5,"Men","Navy / Cream","https://samsonmensemporium.com/cdn/shop/files/Untitled-design---2025-03-12T164604-405_600x.png?v=1741812397"],
  ["Satin Midi Dress",3999,10,"Women","Ivory / Black","https://www.tigerofsweden.com/dw/image/v2/AARW_PRD/on/demandware.static/-/Sites-sfra-tos-master-catalog/default/dw7b23268e/images/113698_31E_main.jpg?q=100&sfrm=jpg&sh=2000&sm=fit&sw=1500"],
  ["Tailored Wide-Leg Pants",2999,5,"Women","Beige / Black","https://orsay.cdn.csagdev.cz/zoh4eiLi/IMG/31536000/l6vXeeJc9ObMqAmA6EXDKV7Q8V26aTLXvnCe501vPq4/fill/3840/5257/sm/1/aHR0cHM6Ly9vcnNheS5jZG4tYmUuY3NhZ2Rldi5jei9jYXRhbG9nL2l0ZW0tcGljdHVyZXMvMzFiOTMwZTYtNDQ1My00MmU1LWFjMjgtODM3ZGRmNmYyNTY1NWMyYWRlNjBjYmY1YzEwNmU1ZDUwNmU0MTBkNDhiZTEtNzE2NzcyLmpwZw%3D%3D"],
  ["Silk Blend Blouse",2799,0,"Women","Cream / Black","https://shop.mango.com/assets/rcs/pics/static/T7/fotos/S/77056735_02_B.jpg?imdensity=1&imwidth=2048&ts=1725982463900"],
  ["Structured Midi Skirt",2499,10,"Women","Black / Olive","https://static.lefties.com/assets/public/cd22/b6ca/7e0e47cbae70/2dcf4beffcbb/01970300800-A6/01970300800-A6.jpg?f=auto&ts=1764833726640&w=800"],
  ["Classic Trench Coat",5499,20,"Women","Beige / Black","https://www.mackintosh.com/cdn/shop/files/WOMENS-FORRESTLM-1153FD-HONEY-OC0961V1-FRONT.jpg?v=1756990240&width=4999"]
].map(([name,price,discount,category,colors,image],i) => ({
  id: 9000+i,
  name: String(name),
  description: "Classy studio product photography, shown without models for the demo collection.",
  price: Number(price),
  discount: Number(discount),
  brand: "ELEGANCE DEMO",
  status: "active",
  images: [{id: 90000+i, image_url: String(image), is_primary: true}],
  variants: String(colors).split(" / ").flatMap((color,ci) =>
    ["S","M","L","XL","XXL"].map((size,si)=>({
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

export async function request<T>(path:string, options?:RequestInit):Promise<T>{
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
      if(cat) data=data.filter(x=>x.category_name?.toLowerCase()===cat.toLowerCase());
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
