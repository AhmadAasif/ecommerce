import { useState, type FormEvent } from "react";
import { API_URL } from "../api";

export default function AdminSetup() {
  const [setupSecret, setSetupSecret] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (setupSecret.length < 32) {
      setError("Enter the setup secret configured by the store owner.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/admin/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupSecret, name, email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Setup failed (${response.status}).`);
      setMessage(data.message || "Admin account created. Remove the setup secret from the backend environment now.");
      setSetupSecret("");
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create admin account.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="admin-login-page">
    <div className="admin-login-card">
      <div className="admin-login-mark">E</div>
      <small>PRIVATE / ONE-TIME INITIAL SETUP</small>
      <h1>CREATE<br/><em>ADMIN.</em></h1>
      <p>This page works only while the backend setup secret is configured and no admin account exists.</p>
      <form className="admin-login-form" onSubmit={submit}>
        <label>SETUP SECRET<input required type="password" autoComplete="off" minLength={32} value={setupSecret} onChange={e=>setSetupSecret(e.target.value)}/></label>
        <label>ADMIN NAME<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>ADMIN EMAIL<input required type="email" maxLength={255} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>NEW PASSWORD<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label>CONFIRM PASSWORD<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        <button className="admin-primary" disabled={busy}>{busy ? "CREATING ADMIN..." : "CREATE FIRST ADMIN"}</button>
      </form>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      <p><a href="/admin">Already have an account? Open admin login.</a></p>
    </div>
  </main>;
}
