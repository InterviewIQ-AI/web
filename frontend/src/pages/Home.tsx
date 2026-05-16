import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrainCircuit, Zap, BarChart3, FileText, ArrowRight, PlayCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: Zap,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    title: 'AI-Powered Questions',
    desc: 'Dynamic, role-specific questions that adapt to your skill level in real time.',
  },
  {
    icon: BarChart3,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    title: 'Real-Time Evaluation',
    desc: 'Instant scoring and detailed feedback on every answer, powered by Gemini AI.',
  },
  {
    icon: FileText,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    title: 'Detailed Reports',
    desc: 'Comprehensive session reports with missing concepts, behavioral analysis, and growth tips.',
  },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 max-w-4xl w-full"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8 uppercase"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
          </span>
          AI-Powered Mock Interviews
        </motion.div>

        {/* Logo + Headline */}
        <div className="flex items-center justify-center mb-6 text-purple-400">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          >
            <BrainCircuit size={72} />
          </motion.div>
        </div>

        <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Ace Your Next
          </span>
          <br />
          <span className="text-white">Interview</span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Practice with an adaptive AI interviewer that evaluates your answers, gives real-time feedback, and helps you land your dream role.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
          <Link
            to={user ? '/dashboard' : '/sign-up'}
            className="group flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-[0_0_30px_rgba(147,51,234,0.35)] hover:shadow-[0_0_45px_rgba(147,51,234,0.5)]"
          >
            <PlayCircle size={22} />
            {user ? 'Go to Dashboard' : 'Start for Free'}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          {user && (
            <Link
              to="/history"
              className="flex items-center justify-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 border border-gray-700"
            >
              <BarChart3 size={22} />
              View History
            </Link>
          )}
          {!user && (
            <Link
              to="/sign-in"
              className="flex items-center justify-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 border border-gray-700"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
              className={`bg-gray-900/50 backdrop-blur border ${f.border} rounded-2xl p-6 hover:scale-[1.02] transition-transform`}
            >
              <div className={`w-12 h-12 ${f.bg} border ${f.border} rounded-xl flex items-center justify-center mb-4`}>
                <f.icon size={24} className={f.color} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-gray-600 text-sm mt-12"
        >
          Powered by Google Gemini AI · Firebase Auth · Real-time Speech Recognition
        </motion.p>
      </motion.div>
    </div>
  );
}
