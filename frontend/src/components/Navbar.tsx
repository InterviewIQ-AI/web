import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Clock, LogOut, ChevronDown, UserCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Quick Start', icon: LayoutDashboard },
  { to: '/history', label: 'History', icon: Clock },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, dbUser, logout } = useAuth();
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

  // Prefer dbUser.name (editable) over Firebase displayName
  const displayName = dbUser?.name || user?.displayName || user?.email;
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() ?? '?';

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4
                 bg-white border-b border-[#E5E5E5]"
    >
      {/* Logo */}
      <NavLink
        to="/"
        className="text-black font-semibold text-lg tracking-tight
                   hover:opacity-70 transition-opacity"
      >
        InterviewIQ
      </NavLink>

      {/* Nav links */}
      <ul className="flex items-center gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 ${isActive
                  ? 'border-black text-black'
                  : 'border-transparent text-[#666666] hover:text-black'
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
            className="flex items-center gap-2 border border-[#E5E5E5] hover:border-[#CCCCCC] px-3 py-2 transition-all"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center text-white text-xs font-semibold">
                {initials}
              </div>
            )}
            <span className="text-sm text-black max-w-[120px] truncate hidden sm:block">
              {displayName}
            </span>
            <ChevronDown size={14} className={`text-[#999999] transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 mt-2 w-52 bg-white border border-[#E5E5E5] shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[#E5E5E5]">
                  <p className="text-xs text-[#999999]">Signed in as</p>
                  <p className="text-sm font-medium text-black truncate">{user.email}</p>
                </div>
                <NavLink
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#666666] hover:bg-[#F5F5F5] hover:text-black transition-colors"
                >
                  <UserCircle size={15} />
                  View Profile
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#666666] hover:bg-[#F5F5F5] hover:text-black transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <NavLink
            to="/sign-in"
            className="text-sm text-[#666666] hover:text-black px-4 py-2 transition-all"
          >
            Sign in
          </NavLink>
          <NavLink
            to="/sign-up"
            className="text-sm bg-black hover:bg-[#333333] text-white px-5 py-2 transition-all font-medium"
          >
            Get Started
          </NavLink>
        </div>
      )}
    </motion.nav>
  );
}
