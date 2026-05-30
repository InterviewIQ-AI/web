import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ChevronRight, Calendar, Award, BarChart3, ArrowRight, FileText, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
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
  if (score === null) return <span className="text-[#999999] font-semibold text-xl">—</span>;
  return <span className="font-semibold text-2xl text-black">{score}<span className="text-sm text-[#999999]">/10</span></span>;
}

export default function Dashboard() {
  const [jobRole, setJobRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resumeJobRole, setResumeJobRole] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [recentSessions, setRecentSessions] = useState<Interview[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const navigate = useNavigate();
  const { user, dbUser } = useAuth();

  // Fetch past sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await apiFetch('/api/interview');
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
      const res = await apiFetch('/api/interview/start', {
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

  const handleStartFromResume = async () => {
    if (!resumeJobRole.trim()) return;
    setResumeLoading(true);
    setResumeError('');
    try {
      const res = await apiFetch('/api/resume/start-from-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobRole: resumeJobRole.trim() }),
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
      setResumeError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setResumeLoading(false);
    }
  };



  const displayName = (dbUser?.name || user?.displayName)?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen p-6 md:p-10">
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
                onKeyDown={(e) => { if (e.key === 'Enter') void handleStart(); }}
                disabled={isLoading}
                className="flex-1 bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all disabled:opacity-50"
              />
              <button
                id="start-interview-btn"
                onClick={handleStart}
                disabled={!jobRole.trim() || isLoading}
                className="flex items-center justify-center gap-2 bg-black hover:bg-[#222222] disabled:bg-[#E5E5E5] disabled:text-[#999999] text-white font-medium px-6 py-3 transition-all whitespace-nowrap"
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin" size={18} />Generating…</>
                ) : (
                  <>Generate Questions</>
                )}
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
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleStartFromResume(); }}
                    disabled={resumeLoading}
                    className="flex-1 bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all disabled:opacity-50"
                  />
                  <button
                    id="start-resume-interview-btn"
                    onClick={handleStartFromResume}
                    disabled={!resumeJobRole.trim() || resumeLoading}
                    className="flex items-center justify-center gap-2 bg-black hover:bg-[#222222] disabled:bg-[#E5E5E5] disabled:text-[#999999] text-white font-medium px-6 py-3 transition-all whitespace-nowrap"
                  >
                    {resumeLoading ? (
                      <><Loader2 className="animate-spin" size={18} />Generating…</>
                    ) : (
                      <>Start Interview</>
                    )}
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
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#999999]">
                        <Calendar size={11} />
                        {new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        <span className="text-[#666666] font-medium uppercase tracking-tight border border-[#E5E5E5] px-1.5 py-0.5 text-[10px]">
                          {session.status}
                        </span>
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
