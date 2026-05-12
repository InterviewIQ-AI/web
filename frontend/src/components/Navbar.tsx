import { NavLink, useLocation } from 'react-router-dom';
import { BrainCircuit, LayoutDashboard, Clock, UploadCloud } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { to: '/dashboard', label: 'Quick Start', icon: LayoutDashboard },
  { to: '/resume',    label: 'Upload Resume', icon: UploadCloud },
  { to: '/history',   label: 'History',      icon: Clock },
];

export default function Navbar() {
  const location = useLocation();

  // Hide navbar inside the interview room — it would be distracting
  if (location.pathname.startsWith('/interview')) return null;

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
                `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
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
    </motion.nav>
  );
}
