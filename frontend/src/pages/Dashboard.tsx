import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BrainCircuit, Loader2, Sparkles, ChevronRight, Calendar, Award, BarChart3, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

interface Question {
  id: number;
  questionText: string;
  category: string;
  difficulty: number;
  expectedConcepts: string[];
}

interface StartResponse {
  interviewId: number;
  question: Question;
  totalQuestions: number;
}

interface Interview {
  id: number;
  jobRole: string;
  status: string;
  finalScore: number | null;
  feedbackSummary: string | null;
  createdAt: string;
  questions: any[];
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-500 font-bold text-xl">—</span>;
  const color = score >= 8 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`font-bold text-2xl ${color}`}>{score}<span className="text-sm text-gray-500">/10</span></span>;
}

export default function Dashboard() {
  const [jobRole, setJobRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [recentSessions, setRecentSessions] = useState<Interview[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch past sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/interview');
        if (!res.ok) return;
        const data: Interview[] = await res.json();
        setRecentSessions(
          data
            .filter(i => i.status === 'COMPLETED')
            .slice(0, 4) // Show latest 4
        );
      } catch (e) {
        console.error('Failed to fetch sessions', e);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, []);

  const handleStart = async () => {
    if (!jobRole.trim()) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobRole: jobRole.trim() }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? 'Failed to start interview');
      }
      const data = await res.json() as StartResponse;
      navigate(`/interview/${data.interviewId}`, {
        state: { interviewId: data.interviewId, question: data.question, totalQuestions: data.totalQuestions },
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleStart();
  };

  const displayName = user?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen p-6 md:p-10 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold text-white mb-1">
            Hey, <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{displayName} 👋</span>
          </h1>
          <p className="text-gray-500">Ready to practice? Start a new interview or review your progress below.</p>
        </motion.div>

        {/* Start Interview Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-3xl p-8 shadow-2xl mb-10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-500/10 rounded-2xl">
              <BrainCircuit size={28} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Start New Interview</h2>
              <p className="text-gray-500 text-sm">AI adapts 10–20 questions to your role</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl px-4 py-3">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="job-role-input"
              type="text"
              placeholder="e.g. Senior Frontend Developer"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50"
            />
            <button
              id="start-interview-btn"
              onClick={handleStart}
              disabled={!jobRole.trim() || isLoading}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(147,51,234,0.25)] hover:shadow-[0_0_28px_rgba(147,51,234,0.4)] whitespace-nowrap"
            >
              {isLoading ? (
                <><Loader2 className="animate-spin" size={18} />Generating…</>
              ) : (
                <><Sparkles size={18} />Generate Questions</>
              )}
            </button>
          </div>
        </motion.div>

        {/* Recent Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 size={22} className="text-purple-400" />
              Recent Sessions
            </h2>
            <Link to="/history" className="flex items-center gap-1 text-sm text-gray-500 hover:text-purple-400 transition-colors">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {sessionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 animate-pulse">
                  <div className="h-4 bg-gray-800 rounded w-2/3 mb-3" />
                  <div className="h-3 bg-gray-800 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-gray-800 rounded w-full" />
                </div>
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/20 border border-dashed border-gray-800 rounded-3xl">
              <Award size={40} className="mx-auto text-gray-700 mb-3" />
              <p className="text-gray-500 mb-1">No completed interviews yet.</p>
              <p className="text-gray-600 text-sm">Start your first session above to see your results here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentSessions.map((session, idx) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  onClick={() => navigate(`/results/${session.id}`)}
                  className="group bg-gray-900/50 border border-gray-800 hover:border-purple-500/40 hover:bg-purple-500/5 rounded-2xl p-5 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 pr-4">
                      <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors line-clamp-1">{session.jobRole}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Calendar size={11} />
                        {new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        <span className="text-green-400 font-medium uppercase tracking-tighter border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 rounded-full text-[10px]">
                          {session.status}
                        </span>
                      </div>
                    </div>
                    <ScoreBadge score={session.finalScore} />
                  </div>
                  {session.feedbackSummary && (
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{session.feedbackSummary}</p>
                  )}
                  <div className="mt-3 flex items-center gap-1 text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    View full report <ChevronRight size={13} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
