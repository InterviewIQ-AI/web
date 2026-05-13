import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, Award, BarChart3, ChevronRight, Search, Filter, 
  Calendar, Briefcase, Trash2, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Interview {
  id: number;
  jobRole: string;
  status: string;
  finalScore: number | null;
  createdAt: string;
  questions: any[];
}

export default function History() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/interview');
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        setInterviews(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredInterviews = interviews.filter(i => 
    i.jobRole.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: interviews.length,
    avgScore: interviews.length > 0 
      ? (interviews.reduce((acc, curr) => acc + (curr.finalScore || 0), 0) / interviews.filter(i => i.finalScore !== null).length || 0).toFixed(1)
      : 0,
    completed: interviews.filter(i => i.status === 'COMPLETED').length
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pt-24 pb-20 px-6 overflow-x-hidden">
      {/* Background Blobs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Interview <span className="text-purple-400">History</span>
            </motion.h1>
            <p className="text-gray-400 text-lg max-w-xl">
              Track your growth, review past sessions, and refine your technique based on AI feedback.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Search by role..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-900/50 border border-gray-800 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all w-full md:w-64 backdrop-blur-md"
              />
            </div>
            <button className="bg-gray-900/50 border border-gray-800 p-3 rounded-xl hover:bg-gray-800 transition-all">
              <Filter size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 p-6 rounded-3xl"
          >
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 mb-4">
              <BarChart3 size={24} />
            </div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Average Score</p>
            <p className="text-3xl font-bold">{stats.avgScore}<span className="text-sm text-gray-500 ml-1">/ 10</span></p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 p-6 rounded-3xl"
          >
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 mb-4">
              <Award size={24} />
            </div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Total Sessions</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 p-6 rounded-3xl"
          >
            <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-400 mb-4">
              <Clock size={24} />
            </div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Completed</p>
            <p className="text-3xl font-bold">{stats.completed}</p>
          </motion.div>
        </div>

        {/* List Section */}
        <div className="space-y-4">
          <AnimatePresence>
            {filteredInterviews.length > 0 ? (
              filteredInterviews.map((interview, idx) => (
                <motion.div
                  key={interview.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(`/results/${interview.id}`)}
                  className="group bg-gray-900/30 border border-gray-800/60 hover:border-purple-500/40 hover:bg-purple-500/5 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500 group-hover:bg-purple-500/10 group-hover:text-purple-400 transition-colors">
                      <Briefcase size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold group-hover:text-white transition-colors">{interview.jobRole}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar size={12} />
                          {new Date(interview.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border ${
                          interview.status === 'COMPLETED' 
                            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                        }`}>
                          {interview.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Score</p>
                      <p className={`text-2xl font-bold ${
                        (interview.finalScore || 0) >= 8 ? 'text-green-400' : 
                        (interview.finalScore || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {interview.finalScore !== null ? `${interview.finalScore}/10` : '--'}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all transform group-hover:translate-x-1">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-gray-900/20 border border-dashed border-gray-800 rounded-3xl">
                <p className="text-gray-500 italic">No interviews found. Start your first session today!</p>
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="mt-4 flex items-center gap-2 mx-auto text-purple-400 font-bold hover:text-purple-300 transition-colors"
                >
                  Go to Quick Start <ArrowRight size={16} />
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
