import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BrainCircuit, LayoutDashboard, Clock, UploadCloud, LogOut, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Quick Start', icon: LayoutDashboard },
  { to: '/resume', label: 'Upload Resume', icon: UploadCloud },
  { to: '/history', label: 'History', icon: Clock },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Hide navbar inside interview room
  if (location.pathname.startsWith('/interview')) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMenuOpen(false);
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() ?? '?';

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4
                 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/60"
    >
      {/* Logo */}
      <NavLink
        to="/"
        className="flex items-center gap-2 text-white font-bold text-lg tracking-tight
                   hover:text-purple-400 transition-colors"
      >
        <BrainCircuit size={24} className="text-purple-400" />
        InterviewIQ
      </NavLink>

      {/* Nav links */}
      <ul className="flex items-center gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* User section */}
      {user ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 rounded-xl px-3 py-2 transition-all"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            )}
            <span className="text-sm text-gray-300 max-w-[120px] truncate hidden sm:block">
              {user.displayName ?? user.email}
            </span>
            <ChevronDown size={14} className={`text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-52 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-gray-800">
                  <p className="text-xs text-gray-500">Signed in as</p>
                  <p className="text-sm font-medium text-white truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <NavLink
            to="/sign-in"
            className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-xl transition-all hover:bg-gray-800/60"
          >
            Sign in
          </NavLink>
          <NavLink
            to="/sign-up"
            className="text-sm bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl transition-all font-medium"
          >
            Get Started
          </NavLink>
        </div>
      )}
    </motion.nav>
  );
}
