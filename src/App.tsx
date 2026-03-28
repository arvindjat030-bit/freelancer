/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Camera, 
  Crosshair, 
  DoorClosed, 
  Bell, 
  Power, 
  Lock, 
  Unlock, 
  AlertTriangle,
  Activity,
  Zap,
  User,
  LogOut,
  Settings,
  Eye,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
interface CameraData {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'alert';
  imageUrl: string;
}

interface WeaponData {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'armed' | 'firing';
  ammo: number;
  imageUrl: string;
}

interface DoorData {
  id: string;
  name: string;
  status: 'locked' | 'unlocked' | 'breached';
  imageUrl: string;
}

interface SensorData {
  id: string;
  name: string;
  location: string;
  triggered: boolean;
  imageUrl: string;
}

interface SystemStatus {
  active: boolean;
  level: 'low' | 'medium' | 'high' | 'critical';
  lastTriggered: string;
  lockdown?: boolean;
}

// --- Components ---

const StatusBadge = ({ status }: { status: string | boolean }) => {
  if (typeof status === 'boolean') {
    return (
      <span className={cn(
        "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border",
        status ? "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse" : "bg-green-500/20 text-green-400 border-green-500/50"
      )}>
        {status ? 'TRIGGERED' : 'SECURE'}
      </span>
    );
  }

  const colors: Record<string, string> = {
    online: 'bg-green-500/20 text-green-400 border-green-500/50',
    offline: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    alert: 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse',
    idle: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    armed: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    firing: 'bg-red-600/20 text-red-500 border-red-600/50 animate-pulse',
    locked: 'bg-green-500/20 text-green-400 border-green-500/50',
    unlocked: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    breached: 'bg-red-600/20 text-red-500 border-red-600/50 animate-pulse',
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border", colors[status] || 'bg-gray-500/20 text-gray-400')}>
      {status}
    </span>
  );
};

const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
  <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-2">
    <Icon className="w-5 h-5 text-cyan-400" />
    <h2 className="text-sm font-mono uppercase tracking-widest text-white/80">{title}</h2>
  </div>
);

export default function App() {
  const [user, setUser] = useState<{username: string, role: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [weapons, setWeapons] = useState<WeaponData[]>([]);
  const [doors, setDoors] = useState<DoorData[]>([]);
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cameras' | 'weapons' | 'access' | 'sensors' | 'ai'>('dashboard');

  const [aiMessages, setAiMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [systemState, setSystemState] = useState<any>(null);

  // --- Auth ---
  useEffect(() => {
    const token = localStorage.getItem('ion_token');
    const savedUser = localStorage.getItem('ion_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('ion_token', data.token);
        localStorage.setItem('ion_user', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Server connection failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ion_token');
    localStorage.removeItem('ion_user');
    setUser(null);
  };

  // --- AI Chat ---
  const sendAiMessage = async () => {
    if (!aiInput.trim()) return;
    const userMsg = aiInput;
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, { role: 'ai', text: data.text }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { role: 'ai', text: "Error connecting to AI core." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- System Sync ---
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [statusRes, camRes, wpnRes, doorRes, snsRes] = await Promise.all([
          fetch('/api/system/status'),
          fetch('/api/system/cameras'),
          fetch('/api/system/weapons'),
          fetch('/api/system/doors'),
          fetch('/api/system/sensors')
        ]);
        
        const status = await statusRes.json();
        const cams = await camRes.json();
        const wpns = await wpnRes.json();
        const drs = await doorRes.json();
        const sns = await snsRes.json();

        setSystemState(status);
        setSystemStatus(status);
        setCameras(cams);
        setWeapons(wpns);
        setDoors(drs);
        setSensors(sns);
      } catch (e) {
        console.error("Failed to fetch system data");
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleLockdown = async () => {
    try {
      const res = await fetch('/api/system/lockdown', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSystemStatus(prev => prev ? { ...prev, lockdown: data.lockdown, level: data.level } : null);
      }
    } catch (e) {
      console.error("Lockdown toggle failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-12 h-12 text-cyan-500 animate-pulse" />
          <span className="font-mono text-cyan-500/50 text-xs tracking-[0.3em] uppercase">Initializing Ion OS...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[#0a0a0a] border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
          <div className="flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/30 rotate-3">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight mb-1 uppercase font-mono">Ion OS Login</h1>
              <p className="text-white/40 text-xs uppercase tracking-widest">Secure Terminal Access</p>
            </div>
            
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] text-white/30 uppercase font-bold ml-1">Username</label>
                <input 
                  type="text" 
                  value={loginData.username}
                  onChange={e => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                  placeholder="admin"
                  required
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[10px] text-white/30 uppercase font-bold ml-1">Security Key</label>
                <input 
                  type="password" 
                  value={loginData.password}
                  onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              {loginError && <p className="text-red-500 text-[10px] font-bold uppercase">{loginError}</p>}
              
              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {isLoggingIn ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
              </button>
            </form>
            
            <p className="text-[9px] text-white/20 uppercase tracking-tighter">Authorized access only. All activity is logged.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <Zap className="w-6 h-6 text-cyan-400" />
            <h1 className="font-bold tracking-tighter text-xl">ION DEFENSE</h1>
          </div>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">v4.2.0-stable</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'cameras', label: 'CCTV Feeds', icon: Camera },
            { id: 'weapons', label: 'Weaponry', icon: Crosshair },
            { id: 'access', label: 'Access Control', icon: DoorClosed },
            { id: 'sensors', label: 'Sensors', icon: Zap },
            { id: 'ai', label: 'AI Digital Twin', icon: Terminal },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group",
                activeTab === item.id 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-cyan-400" : "text-white/20 group-hover:text-white/40")} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-[#111] p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <User className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate">{user.username}</p>
                <p className="text-[10px] text-white/30 truncate uppercase">{user.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full py-2 bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-white/40 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-3 h-3" />
              Terminate Session
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* System Status Card */}
                <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Shield className="w-24 h-24" />
                  </div>
                  <SectionHeader title="System Status" icon={Shield} />
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/40 uppercase font-mono">Defense Grid</span>
                      <span className="text-xs font-bold text-green-400 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        ACTIVE
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/40 uppercase font-mono">Threat Level</span>
                      <span className={cn(
                        "text-xs font-bold uppercase px-2 py-0.5 rounded border",
                        systemStatus?.level === 'critical' ? 'text-red-500 border-red-500/50 bg-red-500/10' : 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'
                      )}>
                        {systemStatus?.level || 'LOW'}
                      </span>
                    </div>
                    <div className="pt-4">
                      <button 
                        onClick={toggleLockdown}
                        className={cn(
                          "w-full py-3 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2",
                          systemStatus?.lockdown ? "bg-red-500 hover:bg-red-600" : "bg-red-600 hover:bg-red-700"
                        )}
                      >
                        <Lock className="w-4 h-4" />
                        {systemStatus?.lockdown ? 'ABORT LOCKDOWN' : 'INITIATE LOCKDOWN'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Facility Map */}
                <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-2xl md:col-span-2">
                  <SectionHeader title="Facility Perimeter Map" icon={Settings} />
                  <div className="relative aspect-[21/9] bg-[#111] rounded-xl overflow-hidden border border-white/5">
                    <img src="https://picsum.photos/seed/blueprint_tech/1200/500" alt="Facility Map" className="w-full h-full object-cover opacity-30" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative w-full h-full">
                        {/* Mock Map Markers */}
                        <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-cyan-500 rounded-full animate-ping" />
                        <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <div className="absolute bottom-1/4 right-1/4 w-3 h-3 bg-green-500 rounded-full" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded border border-white/10">
                      <p className="text-[8px] font-mono text-white/60 uppercase">Sector A-9 Tracking Active</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quick Stats */}
                <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-2xl">
                  <SectionHeader title="Security Overview" icon={Eye} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <p className="text-[10px] text-white/30 uppercase mb-1">Cameras</p>
                      <p className="text-2xl font-bold">{cameras.length}</p>
                      <p className="text-[10px] text-green-400 font-mono">100% Online</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <p className="text-[10px] text-white/30 uppercase mb-1">Sensors</p>
                      <p className="text-2xl font-bold">{sensors.length}</p>
                      <p className="text-[10px] text-orange-400 font-mono">{sensors.filter(s => s.triggered).length} Triggered</p>
                    </div>
                  </div>
                </div>

                {/* Log Feed with Thumbnails */}
                <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-2xl">
                  <SectionHeader title="Recent Alerts & Logs" icon={Terminal} />
                  <div className="space-y-4">
                    <div className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <img src="https://picsum.photos/seed/alert1/100/100" className="w-10 h-10 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                      <div className="flex-1">
                        <p className="text-[10px] font-bold">Motion Detected: Sector 4</p>
                        <p className="text-[8px] text-white/40 font-mono">05:22:10 - Sensor SNS-02</p>
                      </div>
                      <StatusBadge status="alert" />
                    </div>
                    <div className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <img src="https://picsum.photos/seed/alert2/100/100" className="w-10 h-10 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                      <div className="flex-1">
                        <p className="text-[10px] font-bold">Weapon System Armed</p>
                        <p className="text-[8px] text-white/40 font-mono">05:20:05 - Sentry Alpha</p>
                      </div>
                      <StatusBadge status="armed" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Camera Feed Preview */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-white/40">Primary Feed Preview</h3>
                  <button onClick={() => setActiveTab('cameras')} className="text-[10px] text-cyan-400 hover:underline uppercase font-bold">View All Feeds</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {cameras.slice(0, 4).map((cam) => (
                    <div key={cam.id} className="group relative aspect-video bg-[#111] rounded-xl overflow-hidden border border-white/5">
                      <img src={cam.imageUrl} alt={cam.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute top-2 right-2">
                        <StatusBadge status={cam.status} />
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <p className="text-[10px] font-bold">{cam.name}</p>
                        <p className="text-[8px] text-white/40 uppercase">{cam.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'cameras' && (
            <motion.div 
              key="cameras"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="relative h-48 rounded-2xl overflow-hidden mb-8">
                <img src="https://picsum.photos/seed/surveillance_center/1200/400" alt="Surveillance Center" className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <SectionHeader title="CCTV Network Management" icon={Camera} />
                  <p className="text-xs text-white/40 max-w-md">Real-time surveillance monitoring across all sectors. High-definition feeds with automated threat detection enabled.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cameras.map((cam) => (
                    <div key={cam.id} className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden group">
                      <div className="aspect-video relative">
                        <img src={cam.imageUrl} alt={cam.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        
                        {/* AI Detection Simulation */}
                        {cam.status === 'alert' && (
                          <div className="absolute inset-0 border-2 border-red-500/50 animate-pulse pointer-events-none">
                            <div className="absolute top-4 left-4 bg-red-500 text-white text-[8px] font-bold px-1 uppercase">
                              Person Detected: 98% Confidence
                            </div>
                            <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border border-red-500/30" />
                          </div>
                        )}
                        {cam.status === 'online' && (
                          <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-4 left-4 bg-green-500 text-white text-[8px] font-bold px-1 uppercase">
                              Scanning...
                            </div>
                          </div>
                        )}

                        <div className="absolute top-4 right-4">
                          <StatusBadge status={cam.status} />
                        </div>
                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-mono font-bold text-white shadow-sm">LIVE FEED</span>
                        </div>
                      </div>
                    <div className="p-6 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-sm">{cam.name}</h3>
                        <p className="text-xs text-white/40">{cam.location}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                          <Settings className="w-4 h-4 text-white/40" />
                        </button>
                        <button className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-colors">
                          <Eye className="w-4 h-4 text-cyan-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'weapons' && (
            <motion.div 
              key="weapons"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="relative h-48 rounded-2xl overflow-hidden mb-8">
                <img src="https://picsum.photos/seed/armory/1200/400" alt="Armory" className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <SectionHeader title="Automated Weaponry Control" icon={Crosshair} />
                  <p className="text-xs text-white/40 max-w-md">Remote deployment and management of automated defense turrets and tactical drones.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {weapons.map((wpn) => (
                  <div key={wpn.id} className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-8 flex gap-8">
                    <div className="w-48 h-48 bg-[#111] rounded-xl overflow-hidden border border-white/5 shrink-0">
                      <img src={wpn.imageUrl} alt={wpn.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-bold">{wpn.name}</h3>
                          <StatusBadge status={wpn.status} />
                        </div>
                        <p className="text-xs text-white/40 uppercase tracking-widest mb-6">{wpn.type}</p>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-[10px] uppercase font-mono mb-1">
                              <span className="text-white/40">Ammunition</span>
                              <span className="text-cyan-400">{wpn.ammo} / 1000</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-cyan-500 transition-all duration-500" 
                                style={{ width: `${(wpn.ammo / 1000) * 100}%` }} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => {
                            fetch('/api/system/weapon/toggle', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: wpn.id })
                            });
                          }}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                            wpn.status === 'idle' 
                              ? "bg-orange-500/10 text-orange-500 border border-orange-500/30 hover:bg-orange-500/20" 
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                          )}
                        >
                          <Power className="w-4 h-4" />
                          {wpn.status === 'idle' ? 'Arm System' : 'Disarm System'}
                        </button>
                        <button className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-colors">
                          FIRE
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'access' && (
            <motion.div 
              key="access"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="relative h-48 rounded-2xl overflow-hidden mb-8">
                <img src="https://picsum.photos/seed/security_door_hallway/1200/400" alt="Security Hallway" className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <SectionHeader title="Secure Access Control" icon={DoorClosed} />
                  <p className="text-xs text-white/40 max-w-md">Biometric and automated entry point management. Global lockdown protocols available.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {doors.map((door) => (
                  <div key={door.id} className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden group">
                    <div className="h-32 relative">
                      <img src={door.imageUrl} alt={door.name} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center border transition-all",
                          door.status === 'locked' ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        )}>
                          {door.status === 'locked' ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                        </div>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col items-center text-center gap-4">
                      <div>
                        <h3 className="font-bold text-lg">{door.name}</h3>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Status: {door.status}</p>
                      </div>
                      <button 
                        onClick={() => {
                          const gateId = door.id === 'door-01' ? 'main_gate' : 'sector_7';
                          const action = door.status === 'locked' ? 'OPEN' : 'CLOSED';
                          fetch('/api/system/gate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ gateId, action })
                          });
                        }}
                        className={cn(
                          "w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                          door.status === 'locked' ? "bg-white/5 hover:bg-white/10 text-white" : "bg-green-600 hover:bg-green-700 text-white"
                        )}
                      >
                        {door.status === 'locked' ? 'Unlock Entry' : 'Lock Entry'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'sensors' && (
            <motion.div 
              key="sensors"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="relative h-48 rounded-2xl overflow-hidden mb-8">
                <img src="https://picsum.photos/seed/tech_sensors/1200/400" alt="Sensors Hub" className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <SectionHeader title="Environmental Sensors" icon={Zap} />
                  <p className="text-xs text-white/40 max-w-md">Motion, thermal, and laser sensors providing comprehensive perimeter awareness.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sensors.map((sns) => (
                  <div key={sns.id} className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden group">
                    <div className="flex">
                      <div className="w-32 h-32 relative shrink-0">
                        <img src={sns.imageUrl} alt={sns.name} className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex-1 p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                            sns.triggered ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-white/5 border-white/10 text-white/40"
                          )}>
                            <Activity className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm">{sns.name}</h3>
                            <p className="text-xs text-white/40">{sns.location}</p>
                          </div>
                        </div>
                        <StatusBadge status={sns.triggered} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col gap-6"
            >
              <SectionHeader title="AI Digital Twin Interface" icon={Terminal} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-[#0f0f0f] border border-white/5 p-4 rounded-xl">
                  <p className="text-[10px] text-white/30 uppercase mb-2">System Time</p>
                  <p className="text-sm font-mono text-cyan-400">{new Date().toLocaleTimeString()}</p>
                </div>
                <div className="bg-[#0f0f0f] border border-white/5 p-4 rounded-xl">
                  <p className="text-[10px] text-white/30 uppercase mb-2">Security Calculator</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="e.g. 500 * 2"
                      className="flex-1 bg-black border border-white/10 rounded px-2 py-1 text-[10px] focus:outline-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          try {
                            const result = eval((e.target as HTMLInputElement).value.replace(/[^-()\d/*+.]/g, ''));
                            (e.target as HTMLInputElement).value = `Result: ${result}`;
                          } catch (err) {
                            (e.target as HTMLInputElement).value = 'Error';
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="bg-[#0f0f0f] border border-white/5 p-4 rounded-xl">
                  <p className="text-[10px] text-white/30 uppercase mb-2">AI Core Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-mono text-green-400">READY</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 bg-[#0a0a0a] border border-white/5 rounded-2xl flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-xl max-w-[80%]">
                    <p className="text-xs text-cyan-400 font-mono">ION OS AI CORE ONLINE. I am your digital twin. How can I assist with security protocols today?</p>
                  </div>
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={cn(
                      "p-4 rounded-xl max-w-[80%] text-xs font-mono",
                      msg.role === 'user' ? "ml-auto bg-white/5 text-white" : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                    )}>
                      {msg.text}
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-xl max-w-[80%] animate-pulse">
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" />
                        <div className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-white/5 bg-white/5 flex gap-2">
                  <input 
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendAiMessage()}
                    placeholder="Ask about security status, calculations, or protocols..."
                    className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-cyan-500/50"
                  />
                  <button 
                    onClick={sendAiMessage}
                    className="bg-cyan-600 hover:bg-cyan-500 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-colors"
                  >
                    SEND
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
