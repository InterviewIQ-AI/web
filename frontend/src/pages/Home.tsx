import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrainCircuit, ArrowRight, BarChart3, Zap, FileText } from 'lucide-react';
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
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 w-full max-w-4xl"
      >
        <div className="flex items-center justify-center mb-6 text-purple-400">
          <BrainCircuit size={64} />
        </div>
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-heading">
          AI Interviewer Pro
        </h1>
        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          Experience an intelligent mock interview that adapts to your skills, evaluates your answers, and helps you land your dream job.
        </p>

        <div className="flex justify-center mb-16">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (!user) {
                navigate('/sign-in', { state: { returnTo: '/dashboard' } });
                return;
              }
              navigate('/dashboard');
            }}
            className="flex items-center gap-3 bg-purple-600 hover:bg-purple-500 text-white font-bold px-10 py-5 rounded-2xl transition-all shadow-[0_0_40px_rgba(147,51,234,0.35)] text-lg"
          >
            Go to Dashboard <ArrowRight size={22} />
          </motion.button>
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
      </motion.div>
    </div>
  );
}
