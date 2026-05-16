import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Upload, PlayCircle, Loader2, X, ArrowRight, BarChart3, Zap, FileText } from 'lucide-react';
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
  const [showModal, setShowModal] = useState(false);
  const [jobRole, setJobRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleQuickStart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!jobRole.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobRole: jobRole.trim() }),
      });

      if (!res.ok) throw new Error('Failed to start interview');

      const data = await res.json();
      navigate(`/interview/${data.interviewId}`, {
        state: { 
          interviewId: data.interviewId, 
          question: data.question,
          totalQuestions: data.totalQuestions 
        },
      });
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      
      {/* ── Quick Start Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-4">
                  <PlayCircle size={32} className="text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white">Quick Practice</h3>
                <p className="text-gray-500 text-sm mt-1">Specify technology or job role</p>
              </div>

              <form onSubmit={handleQuickStart} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 ml-1">
                    Target Role
                  </label>
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Node.js Developer" 
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    disabled={isLoading}
                    className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-6 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!jobRole.trim() || isLoading}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                >
                  {isLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>Start Session <ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
        
        <div className="flex flex-col md:flex-row gap-8 justify-center items-center mb-16">
          {/* Upload Resume Card */}
          <Link
            to="/resume"
            className="w-full md:w-72 h-64 flex flex-col items-center justify-center gap-5 bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-[2.5rem] hover:bg-gray-800/40 hover:border-purple-500/50 transition-all duration-300 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="p-4 bg-purple-500/10 rounded-2xl group-hover:bg-purple-500/20 transition-colors">
              <Upload size={32} className="text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">Upload Resume</p>
              <p className="text-xs text-gray-500 mt-1">Personalized interview</p>
            </div>
          </Link>
          
          {/* Quick Practice Card */}
          <button
            onClick={() => setShowModal(true)}
            className="w-full md:w-72 h-64 flex flex-col items-center justify-center gap-5 bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-[2.5rem] hover:bg-gray-800/40 hover:border-purple-500/50 transition-all duration-300 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="p-4 bg-purple-500/10 rounded-2xl group-hover:bg-purple-500/20 transition-colors">
              <PlayCircle size={32} className="text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">Quick Practice</p>
              <p className="text-xs text-gray-500 mt-1">Start with any role</p>
            </div>
          </button>
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
