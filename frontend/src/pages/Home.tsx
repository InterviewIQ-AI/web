import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Zap, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: Zap,
    title: 'AI-Powered Questions',
    desc: 'Dynamic, role-specific questions that adapt to your skill level in real time.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Evaluation',
    desc: 'Instant scoring and detailed feedback on every answer, powered by Gemini AI.',
  },
  {
    icon: FileText,
    title: 'Detailed Reports',
    desc: 'Comprehensive session reports with missing concepts, behavioral analysis, and growth tips.',
  },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-3xl"
      >
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#999999] mb-6">
          AI Mock Interview Platform
        </p>
        <h1 className="text-5xl md:text-6xl font-bold text-black mb-6 leading-[1.1] tracking-tight">
          Practice interviews.<br />Get better. Land the job.
        </h1>
        <p className="text-lg text-[#666666] mb-12 max-w-xl mx-auto leading-relaxed">
          An intelligent mock interview that adapts to your skills, evaluates your answers, and helps you prepare with confidence.
        </p>

        <div className="flex justify-center mb-20">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (!user) {
                navigate('/sign-in', { state: { returnTo: '/dashboard' } });
                return;
              }
              navigate('/dashboard');
            }}
            className="flex items-center gap-3 bg-black hover:bg-[#222222] text-white font-semibold px-8 py-4 transition-colors text-base"
          >
            Go to Dashboard <ArrowRight size={18} />
          </motion.button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E5E5E5] border border-[#E5E5E5]">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
              className="bg-white p-8 text-left hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="w-10 h-10 border border-[#E5E5E5] flex items-center justify-center mb-5">
                <f.icon size={20} className="text-black" />
              </div>
              <h3 className="text-base font-semibold text-black mb-2">{f.title}</h3>
              <p className="text-[#666666] text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
