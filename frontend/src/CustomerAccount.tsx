import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "./api";

type Customer = { id: number; name: string; email: string };
const TOKEN_KEY = "customerToken";
const CUSTOMER_KEY = "customerAccount";
async function call(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(API_URL + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.message || "Request failed");
  return body.data;
}

export default function CustomerAccount() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [customer, setCustomer] = useState<Customer | null>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "null"); } catch { return null; }
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const saveSession = (data: any) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
    setCustomer(data.customer);
    window.dispatchEvent(new Event("customer-session-changed"));
    setError("");
  };
  const loadOrders = async () => {
    try { const data = await call("/auth/me/orders"); setOrders(data.orders || []); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load orders"); }
  };
  useEffect(() => { if (customer) void loadOrders(); }, [customer?.id]);
  useEffect(() => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || customer) return;
    const w = window as any;
    const setup = () => {
      if (!w.google?.accounts?.id) return;
      w.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          setBusy(true); setError("");
          try { saveSession(await call("/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential }) })); }
          catch (e) { setError(e instanceof Error ? e.message : "Google sign-in failed"); }
          finally { setBusy(false); }
        }
      });
      const target = document.getElementById("google-signin-button");
      if (target) w.google.accounts.id.renderButton(target, { theme: "outline", size: "large", shape: "rectangular", text: "continue_with", width: 300 });
      setGoogleReady(true);
    };
    if (w.google?.accounts?.id) { setup(); return; }
    let script = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true; script.defer = true; script.dataset.googleIdentity = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", setup);
    return () => script?.removeEventListener("load", setup);
  }, [customer]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await call(mode === "register" ? "/auth/register" : "/auth/login", {
        method: "POST", body: JSON.stringify({ name, email, password })
      });
      saveSession(data);
      setPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in"); }
    finally { setBusy(false); }
  };
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(CUSTOMER_KEY);
    setCustomer(null); setOrders([]); setError("");
    window.dispatchEvent(new Event("customer-session-changed"));
  };

  return <main className="container section narrow">
    <small>CLIENT SERVICE / YOUR ACCOUNT</small><h1>{customer ? "WELCOME BACK." : "YOUR ACCOUNT."}</h1>
    {customer ? <>
      <div className="admin-card"><small>ACCOUNT DETAILS</small><h2>{customer.name}</h2><p>{customer.email}</p><button className="text-link" type="button" onClick={logout}>SIGN OUT</button></div>
      <div className="section-head" id="orders"><div><small>ORDER HISTORY</small><h2>YOUR ORDERS</h2></div></div>
      {orders.length ? orders.map((order: any) => <article className="admin-card" key={order.id}>
        <small>{order.order_number}</small><h3>{String(order.order_status).toUpperCase()}</h3>
        <p>Placed {new Date(order.created_at).toLocaleDateString()} · Payment: {order.payment_status}</p>
        <p><strong>₹{Number(order.total_amount).toLocaleString("en-IN")}</strong></p>
        {(order.items || []).map((item: any, i: number) => <p key={i}>{item.product_name} · {item.size || "One size"} · Qty {item.quantity}</p>)}
        <h4>DELIVERY TIMELINE</h4>
        {(order.statusHistory || []).map((step: any, i: number) => <p key={i}>• {String(step.status).toUpperCase()} · {new Date(step.created_at).toLocaleString()}</p>)}
        <Link className="text-link" to="/track">TRACK ORDER</Link>
      </article>) : <div className="empty">NO ORDERS LINKED TO THIS ACCOUNT YET.</div>}
    </> : <>
      <div className="filters"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>SIGN IN</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>CREATE ACCOUNT</button></div>
      <form className="form" onSubmit={submit}>
        {mode === "register" && <label>FULL NAME<input required minLength={2} maxLength={150} autoComplete="name" value={name} onChange={e => setName(e.target.value)}/></label>}
        <label>EMAIL ADDRESS<input required type="email" maxLength={255} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
        <label>PASSWORD<input required type="password" minLength={mode === "register" ? 12 : 1} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)}/></label>
        {mode === "register" && <small>Use at least 12 characters for a stronger password.</small>}
        <button className="add" disabled={busy}>{busy ? "PLEASE WAIT…" : mode === "register" ? "CREATE ACCOUNT" : "SIGN IN"}</button>
      </form>
      <div className="admin-card"><p>Or continue with Google</p><div id="google-signin-button"/>{!googleReady && !(import.meta as any).env.VITE_GOOGLE_CLIENT_ID && <small>Google sign-in will appear after the store owner configures it.</small>}</div>
      {error && <p className="error">{error}</p>}
    </>}
    {error && customer && <p className="error">{error}</p>}
  </main>;
}
