import { useState } from 'react';
import { Database, Eye, EyeOff, LockKeyhole, Mail, UserRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { authApi, type AuthUser } from '@/services/auth';

export function Login({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = mode === 'login' ? await authApi.login(email, password) : await authApi.register(name, email, password);
      onAuthenticated(result.user);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-[#080d18] text-slate-100 grid lg:grid-cols-2">
    <section className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-white/10 p-12 xl:p-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(14,165,233,.20),transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(99,102,241,.15),transparent_45%)]" />
      <div className="relative flex items-center gap-3"><div className="rounded-xl bg-cyan-400/15 p-2.5 text-cyan-300"><Database size={25}/></div><div><div className="text-lg font-semibold tracking-tight">DataLake AI</div><div className="text-xs text-slate-400">INTELLIGENT DATA PLATFORM</div></div></div>
      <div className="relative max-w-xl"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs text-cyan-200"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/> Secure workspace access</div><h1 className="text-4xl font-semibold leading-tight xl:text-5xl">Your data foundation.<br/><span className="text-cyan-300">Built for what’s next.</span></h1><p className="mt-6 max-w-lg text-base leading-7 text-slate-400">Bring datasets, pipelines, quality checks, and lineage together in one reliable workspace built for modern data teams.</p>
      <div className="mt-10 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><ShieldCheck className="mb-3 text-cyan-300" size={21}/><div className="text-sm font-medium">Security-first access</div><div className="mt-1 text-xs text-slate-400">Protected authentication</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Database className="mb-3 text-indigo-300" size={21}/><div className="text-sm font-medium">Connected data</div><div className="mt-1 text-xs text-slate-400">PostgreSQL-backed records</div></div></div></div>
      <div className="relative text-xs text-slate-500">DATA OPERATIONS · QUALITY · OBSERVABILITY</div>
    </section>
    <section className="flex items-center justify-center px-5 py-10 sm:px-10"><div className="w-full max-w-md">
      <div className="mb-10 flex items-center gap-3 lg:hidden"><div className="rounded-xl bg-cyan-400/15 p-2.5 text-cyan-300"><Database size={24}/></div><div className="text-lg font-semibold">DataLake AI</div></div>
      <div className="mb-8"><p className="text-sm font-medium text-cyan-300">WELCOME TO YOUR WORKSPACE</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</h2><p className="mt-2 text-sm text-slate-400">{mode === 'login' ? 'Enter your credentials to access your data platform.' : 'Set up a secure account for your data workspace.'}</p></div>
      <form onSubmit={submit} className="space-y-5">
        {mode === 'register' && <div><label className="mb-2 block text-sm text-slate-300">Full name</label><div className="relative"><UserRound className="absolute left-3.5 top-3.5 text-slate-500" size={18}/><input required minLength={2} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"/></div></div>}
        <div><label className="mb-2 block text-sm text-slate-300">Work email</label><div className="relative"><Mail className="absolute left-3.5 top-3.5 text-slate-500" size={18}/><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"/></div></div>
        <div><label className="mb-2 block text-sm text-slate-300">Password</label><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 text-slate-500" size={18}/><input required minLength={8} type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-12 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-200">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
        {error && <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-300">{error}</div>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">{busy?'Please wait…':mode==='login'?'Sign in securely':'Create account'} {!busy&&<ArrowRight size={17}/>}</button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400">{mode==='login'?"New to DataLake AI?":"Already have an account?"} <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}} className="font-medium text-cyan-300 hover:text-cyan-200">{mode==='login'?'Create an account':'Sign in'}</button></p>
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={14}/> Your credentials are encrypted in transit.</div>
    </div></section>
  </div>;
}
