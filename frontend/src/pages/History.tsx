import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Award, BarChart3, ChevronRight, Search, Filter,
  Calendar, Briefcase, ArrowRight, TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { apiFetch } from '../lib/api';

interface Interview {
  id: number;
  jobRole: string;
  status: string;
  finalScore: number | null;
  createdAt: string;
  questions: any[];
}

// Grayscale palette for up to 6 distinct roles on the chart
const ROLE_COLORS = ['#000000', '#444444', '#777777', '#AAAAAA', '#555555', '#888888'];

export default function History() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showChart, setShowChart] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiFetch('/api/interview');
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

  const completed = interviews.filter(i => i.status === 'COMPLETED' && i.finalScore !== null);

  const stats = {
    total: interviews.length,
    avgScore:
      completed.length > 0
        ? (completed.reduce((acc, curr) => acc + (curr.finalScore ?? 0), 0) / completed.length).toFixed(1)
        : '0',
    completedCount: completed.length,
  };

  // ─── Build chart data ───────────────────────────────────────────────────────
  const uniqueRoles = [...new Set(completed.map(i => i.jobRole))].slice(0, 6);

  const sortedCompleted = [...completed].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const chartData = sortedCompleted.map((interview) => {
    const label = new Date(interview.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const row: Record<string, any> = { date: label };
    row[interview.jobRole] = interview.finalScore;
    return row;
  });

  const mergedChart: Record<string, any>[] = [];
  const seen = new Map<string, number>();
  for (const row of chartData) {
    if (seen.has(row.date)) {
      Object.assign(mergedChart[seen.get(row.date)!], row);
    } else {
      seen.set(row.date, mergedChart.length);
      mergedChart.push({ ...row });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-10 h-10 border-2 border-black border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black pt-24 pb-20 px-6 overflow-x-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl md:text-4xl font-bold mb-3"
            >
              Interview History
            </motion.h1>
            <p className="text-[#666666] text-base max-w-xl">
              Track your growth, review past sessions, and refine your technique based on AI feedback.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#CCCCCC]" size={16} />
              <input
                type="text"
                placeholder="Search by role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-[#E5E5E5] pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-black transition-all w-full md:w-56"
              />
            </div>
            <button className="border border-[#E5E5E5] p-2.5 hover:border-black transition-all">
              <Filter size={16} className="text-[#666666]" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#E5E5E5] border border-[#E5E5E5] mb-12">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
            className="bg-white p-6"
          >
            <div className="w-10 h-10 border border-[#E5E5E5] flex items-center justify-center text-black mb-4">
              <BarChart3 size={20} />
            </div>
            <p className="text-[#999999] text-xs font-semibold uppercase tracking-widest mb-1">Average Score</p>
            <p className="text-3xl font-bold">{stats.avgScore}<span className="text-sm text-[#999999] ml-1">/ 10</span></p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="bg-white p-6"
          >
            <div className="w-10 h-10 border border-[#E5E5E5] flex items-center justify-center text-black mb-4">
              <Award size={20} />
            </div>
            <p className="text-[#999999] text-xs font-semibold uppercase tracking-widest mb-1">Total Sessions</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="bg-white p-6"
          >
            <div className="w-10 h-10 border border-[#E5E5E5] flex items-center justify-center text-black mb-4">
              <Clock size={20} />
            </div>
            <p className="text-[#999999] text-xs font-semibold uppercase tracking-widest mb-1">Completed</p>
            <p className="text-3xl font-bold">{stats.completedCount}</p>
          </motion.div>
        </div>

        {/* Score Trend Chart */}
        {mergedChart.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-[#E5E5E5] p-8 mb-12"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <TrendingUp size={11} /> Score Trend
                </p>
                <h2 className="text-lg font-semibold">Performance Over Time</h2>
              </div>
              <button
                onClick={() => setShowChart(v => !v)}
                className="text-xs font-medium text-[#999999] hover:text-black transition-colors"
              >
                {showChart ? 'Hide' : 'Show'}
              </button>
            </div>

            <AnimatePresence>
              {showChart && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 260, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={mergedChart} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                      <XAxis dataKey="date" tick={{ fill: '#999999', fontSize: 11 }} axisLine={{ stroke: '#E5E5E5' }} />
                      <YAxis domain={[0, 10]} tick={{ fill: '#999999', fontSize: 11 }} axisLine={{ stroke: '#E5E5E5' }} />
                      <Tooltip
                        contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 0 }}
                        labelStyle={{ color: '#000000', fontWeight: 600 }}
                        formatter={(val: any, name: any) => [`${val}/10`, name]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: '#666666', paddingTop: 12 }}
                      />
                      {uniqueRoles.map((role, i) => (
                        <Line
                          key={role}
                          type="monotone"
                          dataKey={role}
                          stroke={ROLE_COLORS[i % ROLE_COLORS.length]}
                          strokeWidth={2}
                          dot={{ fill: ROLE_COLORS[i % ROLE_COLORS.length], r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Interview List */}
        <div className="space-y-0 border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
          <AnimatePresence>
            {filteredInterviews.length > 0 ? (
              filteredInterviews.map((interview, idx) => (
                <motion.div
                  key={interview.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate(`/results/${interview.id}`)}
                  className="group p-6 flex flex-col md:flex-row items-center justify-between gap-4 cursor-pointer transition-colors hover:bg-[#FAFAFA]"
                >
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="w-12 h-12 border border-[#E5E5E5] flex items-center justify-center text-[#999999] group-hover:border-black group-hover:text-black transition-colors">
                      <Briefcase size={22} />
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-black">{interview.jobRole}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1.5 text-xs text-[#999999]">
                          <Calendar size={11} />
                          {new Date(interview.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 uppercase tracking-tight border ${
                          interview.status === 'COMPLETED'
                            ? 'border-[#E5E5E5] text-[#666666] bg-[#FAFAFA]'
                            : 'border-[#E5E5E5] text-[#999999] bg-[#FAFAFA]'
                        }`}>
                          {interview.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-[#999999] uppercase tracking-widest mb-1">Score</p>
                      <p className="text-xl font-semibold text-black">
                        {interview.finalScore !== null ? `${interview.finalScore}/10` : '--'}
                      </p>
                    </div>
                    <div className="w-8 h-8 border border-[#E5E5E5] flex items-center justify-center group-hover:border-black group-hover:bg-black group-hover:text-white transition-all">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20">
                <p className="text-[#999999]">No interviews found. Start your first session today!</p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-4 flex items-center gap-2 mx-auto text-black font-medium hover:opacity-70 transition-opacity"
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
