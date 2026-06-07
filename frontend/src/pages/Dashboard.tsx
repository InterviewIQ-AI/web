import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Loader2, ChevronRight, Calendar, Award, BarChart3, ArrowRight,
  FileText, UserCircle, X, Users, Briefcase, Code2, Zap, Target, Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

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
  roundType: string;
  difficulty: string;
}

interface Interview {
  id: number;
  jobRole: string;
  status: string;
  finalScore: number | null;
  feedbackSummary: string | null;
  createdAt: string;
  roundType?: string;
  difficulty?: string;
  questions: any[];
}

type RoundType = 'HR' | 'MR' | 'TR';
type Difficulty = 'easy' | 'medium' | 'hard';

const ROUND_OPTIONS: { type: RoundType; label: string; subtitle: string; icon: any; color: string }[] = [
  {
    type: 'HR',
    label: 'HR Round',
    subtitle: 'Behavioral & cultural fit',
    icon: Users,
    color: 'from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-400',
  },
  {
    type: 'MR',
    label: 'Managerial Round',
    subtitle: 'Leadership & decision-making',
    icon: Briefcase,
    color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400',
  },
  {
    type: 'TR',
    label: 'Technical Round',
    subtitle: 'Concepts & system design',
    icon: Code2,
    color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-400',
  },
];

const DIFFICULTY_OPTIONS: { level: Difficulty; label: string; desc: string; icon: any; color: string }[] = [
  {
    level: 'easy',
    label: 'Easy',
    desc: 'Entry level · 0–2 yrs',
    icon: Zap,
    color: 'from-green-500/20 to-green-600/10 border-green-500/30 hover:border-green-400',
  },
  {
    level: 'medium',
    label: 'Medium',
    desc: 'Mid level · 2–5 yrs',
    icon: Target,
    color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:border-orange-400',
  },
  {
    level: 'hard',
    label: 'Hard',
    desc: 'Senior level · 6+ yrs',
    icon: Trophy,
    color: 'from-red-500/20 to-red-600/10 border-red-500/30 hover:border-red-400',
  },
];

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[#999999] font-semibold text-xl">—</span>;
  return <span className="font-semibold text-2xl text-black">{score}<span className="text-sm text-[#999999]">/10</span></span>;
}

// ─── Pre-Interview Config Modal ───────────────────────────────────────────────
function ConfigModal({
  open,
  onClose,
  onStart,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (roundType: RoundType, difficulty: Difficulty) => void;
  loading: boolean;
}) {
  const [round, setRound] = useState<RoundType | null>(null);
  const [diff, setDiff] = useState<Difficulty | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="bg-white border border-[#E5E5E5] w-full max-w-lg shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#E5E5E5]">
              <div>
                <h2 className="text-lg font-bold text-black">Configure Your Interview</h2>
                <p className="text-sm text-[#666666] mt-0.5">Choose the round type and difficulty level</p>
              </div>
              <button onClick={onClose} className="text-[#999999] hover:text-black transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Round Type */}
              <div>
                <p className="text-xs font-semibold text-[#999999] uppercase tracking-widest mb-3">Select Round</p>
                <div className="grid grid-cols-3 gap-3">
                  {ROUND_OPTIONS.map(({ type, label, subtitle, icon: Icon, color }) => (
                    <button
                      key={type}
                      onClick={() => setRound(type)}
                      className={`
                        relative flex flex-col items-center gap-2 p-4 border-2 bg-gradient-to-b transition-all duration-200
                        ${color}
                        ${round === type
                          ? 'ring-2 ring-offset-2 ring-black border-black'
                          : 'border-[#E5E5E5] bg-[#FAFAFA]'
                        }
                      `}
                    >
                      {round === type && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-black rounded-full" />
                      )}
                      <Icon size={22} className={round === type ? 'text-black' : 'text-[#666666]'} />
                      <div className="text-center">
                        <p className={`text-sm font-semibold ${round === type ? 'text-black' : 'text-[#333333]'}`}>{label}</p>
                        <p className="text-[10px] text-[#999999] leading-tight mt-0.5">{subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <p className="text-xs font-semibold text-[#999999] uppercase tracking-widest mb-3">Select Difficulty</p>
                <div className="grid grid-cols-3 gap-3">
                  {DIFFICULTY_OPTIONS.map(({ level, label, desc, icon: Icon, color }) => (
                    <button
                      key={level}
                      onClick={() => setDiff(level)}
                      className={`
                        relative flex flex-col items-center gap-2 p-4 border-2 bg-gradient-to-b transition-all duration-200
                        ${color}
                        ${diff === level
                          ? 'ring-2 ring-offset-2 ring-black border-black'
                          : 'border-[#E5E5E5] bg-[#FAFAFA]'
                        }
                      `}
                    >
                      {diff === level && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-black rounded-full" />
                      )}
                      <Icon size={22} className={diff === level ? 'text-black' : 'text-[#666666]'} />
                      <div className="text-center">
                        <p className={`text-sm font-semibold ${diff === level ? 'text-black' : 'text-[#333333]'}`}>{label}</p>
                        <p className="text-[10px] text-[#999999] leading-tight mt-0.5">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Round description callout */}
              <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-4 text-sm text-[#666666]">
                {round === 'HR' && (
                  <p>🎯 <strong className="text-black">HR Round:</strong> Focuses on your personality, motivation, teamwork, and cultural fit. All questions are conversational and behavioural.</p>
                )}
                {round === 'MR' && (
                  <p>🏆 <strong className="text-black">Managerial Round:</strong> Explores your leadership experience, stakeholder management, and decision-making. Mix of behavioural and strategic questions.</p>
                )}
                {round === 'TR' && (
                  <p>💡 <strong className="text-black">Technical Round:</strong> Tests your technical depth through verbal explanation — concepts, architecture, and trade-offs. No coding required.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => round && diff && onStart(round, diff)}
                disabled={loading || !round || !diff}
                className="w-full flex items-center justify-center gap-2 bg-black hover:bg-[#222222] disabled:bg-[#E5E5E5] disabled:text-[#999999] text-white font-semibold py-3.5 transition-all text-sm"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Generating questions…</>
                ) : (
                  <>
                    <span>Start Interview</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              {(!round || !diff) && !loading && (
                <p className="text-center text-xs text-[#999999] mt-2">Please select a round type and difficulty to continue.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [jobRole, setJobRole] = useState('');
  const [resumeJobRole, setResumeJobRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [recentSessions, setRecentSessions] = useState<Interview[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'quick' | 'resume'>('quick');

  const navigate = useNavigate();
  const { user, dbUser } = useAuth();

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await apiFetch('/api/interview');
        if (!res.ok) return;
        const data: Interview[] = await res.json();
        setRecentSessions(
          data
            .filter(i => i.status === 'COMPLETED')
            .slice(0, 4)
        );
      } catch (e) {
        console.error('Failed to fetch sessions', e);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, []);

  const handleOpenModal = (mode: 'quick' | 'resume') => {
    if (mode === 'quick' && !jobRole.trim()) return;
    if (mode === 'resume' && !resumeJobRole.trim()) return;
    setErrorMsg('');
    setResumeError('');
    setModalMode(mode);
    setShowModal(true);
  };

  const handleStart = async (roundType: RoundType, difficulty: Difficulty) => {
    const role = modalMode === 'quick' ? jobRole : resumeJobRole;
    setIsLoading(true);
    try {
      const endpoint = modalMode === 'resume' ? '/api/resume/start-from-profile' : '/api/interview/start';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobRole: role.trim(), roundType, difficulty }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? 'Failed to start interview');
      }
      const data = await res.json() as StartResponse;
      setShowModal(false);
      navigate(`/interview/${data.interviewId}`, {
        state: {
          interviewId: data.interviewId,
          question: data.question,
          totalQuestions: data.totalQuestions,
          roundType: data.roundType ?? roundType,
          difficulty: data.difficulty ?? difficulty,
          jobRole: role.trim(),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (modalMode === 'quick') setErrorMsg(msg);
      else setResumeError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = (dbUser?.name || user?.displayName)?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen p-6 md:p-10">
      <ConfigModal
        open={showModal}
        onClose={() => { if (!isLoading) setShowModal(false); }}
        onStart={handleStart}
        loading={isLoading}
      />

      <div className="max-w-5xl mx-auto">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold text-black mb-1">
            Hey, {displayName}
          </h1>
          <p className="text-[#666666]">Ready to practice? Start a new interview or review your progress below.</p>
        </motion.div>

        {/* Cards row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* ── Quick Start Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="border border-[#E5E5E5] p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 border border-[#E5E5E5]">
                <BarChart3 size={20} className="text-black" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-black">Quick Start</h2>
                <p className="text-[#999999] text-sm">AI adapts 10–20 questions to your role</p>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 bg-[#FEF2F2] border border-[#FECACA] text-[#D00000] text-sm px-4 py-3">
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleOpenModal('quick'); }}
                disabled={isLoading}
                className="flex-1 bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all disabled:opacity-50"
              />
              <button
                id="start-interview-btn"
                onClick={() => handleOpenModal('quick')}
                disabled={!jobRole.trim() || isLoading}
                className="flex items-center justify-center gap-2 bg-black hover:bg-[#222222] disabled:bg-[#E5E5E5] disabled:text-[#999999] text-white font-medium px-6 py-3 transition-all whitespace-nowrap"
              >
                Configure & Start
              </button>
            </div>
          </motion.div>

          {/* ── Start from Resume Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="border border-[#E5E5E5] p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 border border-[#E5E5E5]">
                <FileText size={20} className="text-black" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-black">Start from My Resume</h2>
                <p className="text-[#999999] text-sm">AI tailors questions to your uploaded resume</p>
              </div>
            </div>

            {dbUser?.resumeText ? (
              <>
                <div className="flex items-center gap-2 mb-4 bg-[#F5F5F5] border border-[#E5E5E5] px-3 py-2">
                  <FileText size={14} className="text-[#666666] flex-shrink-0" />
                  <span className="text-[#666666] text-xs font-medium">Resume on file · {Math.round(dbUser.resumeText.length / 100) / 10}k chars</span>
                </div>

                {resumeError && (
                  <div className="mb-4 bg-[#FEF2F2] border border-[#FECACA] text-[#D00000] text-sm px-4 py-3">
                    {resumeError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    id="resume-job-role-input"
                    type="text"
                    placeholder="e.g. Senior Frontend Developer"
                    value={resumeJobRole}
                    onChange={(e) => setResumeJobRole(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleOpenModal('resume'); }}
                    disabled={isLoading}
                    className="flex-1 bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all disabled:opacity-50"
                  />
                  <button
                    id="start-resume-interview-btn"
                    onClick={() => handleOpenModal('resume')}
                    disabled={!resumeJobRole.trim() || isLoading}
                    className="flex items-center justify-center gap-2 bg-black hover:bg-[#222222] disabled:bg-[#E5E5E5] disabled:text-[#999999] text-white font-medium px-6 py-3 transition-all whitespace-nowrap"
                  >
                    Configure & Start
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-4 gap-3">
                <p className="text-[#999999] text-sm">No resume uploaded yet.</p>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 border border-[#E5E5E5] hover:border-black text-black font-medium px-5 py-2.5 transition-all text-sm"
                >
                  <UserCircle size={16} /> Upload in Profile
                </Link>
              </div>
            )}
          </motion.div>
        </div>

        {/* Recent Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-black">
              Recent Sessions
            </h2>
            <Link to="/history" className="flex items-center gap-1 text-sm text-[#666666] hover:text-black transition-colors">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {sessionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="border border-[#E5E5E5] p-6 animate-pulse">
                  <div className="h-4 bg-[#F5F5F5] rounded w-2/3 mb-3" />
                  <div className="h-3 bg-[#F5F5F5] rounded w-1/3 mb-3" />
                  <div className="h-3 bg-[#F5F5F5] rounded w-full" />
                </div>
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[#E5E5E5]">
              <Award size={32} className="mx-auto text-[#CCCCCC] mb-3" />
              <p className="text-[#666666] mb-1">No completed interviews yet.</p>
              <p className="text-[#999999] text-sm">Start your first session above to see your results here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentSessions.map((session, idx) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  onClick={() => navigate(`/results/${session.id}`)}
                  className="group border border-[#E5E5E5] hover:border-black p-5 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 pr-4">
                      <h3 className="font-medium text-black line-clamp-1">{session.jobRole}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#999999] flex-wrap">
                        <Calendar size={11} />
                        {new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        <span className="text-[#666666] font-medium uppercase tracking-tight border border-[#E5E5E5] px-1.5 py-0.5 text-[10px]">
                          {session.status}
                        </span>
                        {session.roundType && (
                          <span className="text-[#666666] font-medium uppercase tracking-tight border border-[#E5E5E5] px-1.5 py-0.5 text-[10px]">
                            {session.roundType}
                          </span>
                        )}
                      </div>
                    </div>
                    <ScoreBadge score={session.finalScore} />
                  </div>
                  {session.feedbackSummary && (
                    <p className="text-[#999999] text-xs leading-relaxed line-clamp-2">{session.feedbackSummary}</p>
                  )}
                  <div className="mt-3 flex items-center gap-1 text-xs text-black opacity-0 group-hover:opacity-100 transition-opacity font-medium">
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
