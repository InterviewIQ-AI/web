import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Download, Share2,
  Target, Award, Clock, MessageSquare, ChevronRight, ChevronDown,
  Lightbulb, BookOpen, TrendingUp, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { apiFetch } from '../lib/api';

interface Answer {
  id: number;
  userAnswer: string;
  score: number;
  feedback: string;
  idealAnswer?: string;
  missingConcepts: string[];
  timeTakenSeconds: number;
  behavioralFeedback?: {
    eyeContact: string;
    posture: string;
    confidence: string;
    overall: string;
  };
}

interface Question {
  id: number;
  questionText: string;
  category: string;
  difficulty: number;
  expectedConcepts: string[];
  answers: Answer[];
}

interface StudyPlan {
  summary: string;
  focusAreas: string[];
  dailyPlan: { day: number; task: string }[];
  resources: string[];
}

interface InterviewData {
  id: number;
  jobRole: string;
  finalScore: number;
  feedbackSummary: string;
  createdAt: string;
  studyPlan?: StudyPlan | null;
  questions: Question[];
}

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'skills' | 'plan'>('breakdown');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await apiFetch(`/api/interview/${id}`);
        if (!res.ok) throw new Error('Failed to fetch results');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchResults();
  }, [id]);

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

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="text-center space-y-4">
          <AlertCircle size={48} className="mx-auto text-[#D00000]" />
          <h2 className="text-2xl font-bold text-black">Could not load results</h2>
          <p className="text-[#666666] max-w-md mx-auto">{error || 'The interview session was not found.'}</p>
          <button
            onClick={() => navigate('/')}
            className="border border-[#E5E5E5] hover:border-black text-black px-6 py-2 transition-all"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  // ─── Build radar chart data from expectedConcepts + scores ─────────────────
  const conceptScores: Record<string, { total: number; count: number }> = {};
  data.questions.forEach((q) => {
    const score = q.answers[0]?.score ?? 0;
    const concepts = q.expectedConcepts ?? [];
    concepts.forEach((concept) => {
      if (!conceptScores[concept]) conceptScores[concept] = { total: 0, count: 0 };
      conceptScores[concept].total += score;
      conceptScores[concept].count += 1;
    });
  });

  const radarData = Object.entries(conceptScores)
    .slice(0, 8)
    .map(([concept, { total, count }]) => ({
      concept: concept.length > 18 ? concept.slice(0, 18) + '…' : concept,
      score: parseFloat((total / count).toFixed(1)),
      fullMark: 10,
    }));

  const studyPlan: StudyPlan | null = data.studyPlan ?? null;

  const tabs = [
    { key: 'breakdown', label: 'Session Breakdown', icon: MessageSquare },
    { key: 'skills', label: 'Skill Radar', icon: TrendingUp },
    ...(studyPlan ? [{ key: 'plan', label: 'Study Plan', icon: BookOpen }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-white text-black pb-20 overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-6 pt-12">
        {/* Navigation */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-[#666666] hover:text-black transition-colors mb-8 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 border border-[#E5E5E5] text-[#666666] text-xs font-medium tracking-widest uppercase">
                Interview Report
              </span>
              <span className="text-[#999999] text-sm">
                {new Date(data.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-black">
              {data.jobRole}
            </h1>
            <p className="text-[#666666] text-base max-w-2xl leading-relaxed">
              {data.feedbackSummary}
            </p>
          </div>

          {/* Overall Score Circle */}
          <div className="flex flex-col items-center border border-[#E5E5E5] p-8 shrink-0">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="50" fill="none" stroke="#E5E5E5" strokeWidth="4" />
                <motion.circle
                  cx="56" cy="56" r="50" fill="none" stroke="#000000" strokeWidth="4"
                  strokeDasharray="314.16"
                  initial={{ strokeDashoffset: 314.16 }}
                  animate={{ strokeDashoffset: 314.16 - (314.16 * (data.finalScore || 0)) / 10 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold">{data.finalScore || 0}</span>
                <span className="text-[10px] text-[#999999] font-medium uppercase tracking-widest">/ 10</span>
              </div>
            </div>
            <span className="mt-4 font-medium text-xs uppercase tracking-[0.15em] text-[#999999]">Overall Score</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#E5E5E5] border border-[#E5E5E5] mb-12">
          <div className="bg-white p-6 flex items-center gap-4">
            <div className="w-10 h-10 border border-[#E5E5E5] flex items-center justify-center text-black">
              <Target size={20} />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider mb-1">Total Questions</p>
              <p className="text-xl font-semibold">{data.questions.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 flex items-center gap-4">
            <div className="w-10 h-10 border border-[#E5E5E5] flex items-center justify-center text-black">
              <Award size={20} />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider mb-1">Strong Answers</p>
              <p className="text-xl font-semibold">{data.questions.filter(q => (q.answers[0]?.score ?? 0) >= 8).length}</p>
            </div>
          </div>
          <div className="bg-white p-6 flex items-center gap-4">
            <div className="w-10 h-10 border border-[#E5E5E5] flex items-center justify-center text-black">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider mb-1">Avg Time / Q</p>
              <p className="text-xl font-semibold">
                {data.questions.length > 0
                  ? `${Math.round(data.questions.reduce((s, q) => s + (q.answers[0]?.timeTakenSeconds ?? 0), 0) / data.questions.length)}s`
                  : '--'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-8 border-b border-[#E5E5E5] overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-black text-black'
                  : 'border-transparent text-[#999999] hover:text-[#666666]'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Session Breakdown ── */}
        {activeTab === 'breakdown' && (
          <div className="space-y-0 border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
            {data.questions.map((q, idx) => {
              const answer = q.answers[0];
              const isExpanded = expandedQuestion === q.id;
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <div
                    onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                    className="p-6 cursor-pointer hover:bg-[#FAFAFA] transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 flex items-start gap-4">
                      <div className="w-8 h-8 border border-[#E5E5E5] flex items-center justify-center text-xs font-semibold text-[#999999] shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-medium text-black mb-1 leading-tight">{q.questionText}</h3>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] font-medium px-2 py-0.5 bg-[#F5F5F5] text-[#666666] uppercase tracking-widest border border-[#E5E5E5]">
                            {q.category}
                          </span>
                          <span className="text-[10px] text-[#999999]">{answer?.timeTakenSeconds || 0}s response</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="px-3 py-1 border border-[#E5E5E5] text-sm font-semibold text-black">
                        {answer?.score || 0}/10
                      </div>
                      {isExpanded ? <ChevronDown size={18} className="text-[#999999]" /> : <ChevronRight size={18} className="text-[#999999]" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 pt-0 border-t border-[#E5E5E5] space-y-6 bg-[#FAFAFA]">
                          <div className="mt-6">
                            <p className="text-[10px] font-medium text-[#999999] uppercase tracking-widest mb-2">Your Answer</p>
                            <div className="text-[#666666] text-sm leading-relaxed italic bg-white p-4 border border-[#E5E5E5]">
                              "{answer?.userAnswer || 'No answer recorded.'}"
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-[#999999] uppercase tracking-widest mb-2">AI Feedback</p>
                            <p className="text-[#666666] text-sm leading-relaxed">{answer?.feedback || 'Evaluation pending.'}</p>
                          </div>
                          {answer?.idealAnswer && (
                            <div className="p-4 bg-white border border-[#E5E5E5]">
                              <p className="text-[10px] font-medium text-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Lightbulb size={12} /> Model Answer
                              </p>
                              <p className="text-[#666666] text-sm leading-relaxed italic">{answer.idealAnswer}</p>
                            </div>
                          )}
                          {answer?.missingConcepts?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-[#999999] uppercase tracking-widest mb-2">Missing Concepts</p>
                              <div className="flex flex-wrap gap-2">
                                {answer.missingConcepts.map(c => (
                                  <span key={c} className="bg-[#F5F5F5] text-black text-[10px] font-medium px-2 py-1 border border-[#E5E5E5] uppercase tracking-wider">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {answer?.behavioralFeedback && q.category === 'BEHAVIORAL' && (
                            <div className="bg-white border border-[#E5E5E5] p-5">
                              <p className="text-[10px] font-medium text-black uppercase tracking-[0.15em] mb-4">Behavioral Analysis</p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div>
                                  <p className="text-[10px] font-medium text-[#999999] uppercase mb-1">Eye Contact</p>
                                  <p className="text-sm text-[#666666]">{answer.behavioralFeedback.eyeContact}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-medium text-[#999999] uppercase mb-1">Posture</p>
                                  <p className="text-sm text-[#666666]">{answer.behavioralFeedback.posture}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-medium text-[#999999] uppercase mb-1">Confidence</p>
                                  <p className="text-sm text-[#666666]">{answer.behavioralFeedback.confidence}</p>
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
                                <p className="text-[10px] font-medium text-[#999999] uppercase mb-1">Overall Body Language</p>
                                <p className="text-sm text-[#666666] italic">"{answer.behavioralFeedback.overall}"</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Tab: Skill Radar ── */}
        {activeTab === 'skills' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {radarData.length < 3 ? (
              <div className="text-center py-16 text-[#999999]">
                <TrendingUp size={40} className="mx-auto mb-4 opacity-30" />
                <p>Not enough concept data to build a radar chart yet.</p>
                <p className="text-sm mt-1">Complete more questions with expected concepts to see this.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Skill Radar */}
                <div className="border border-[#E5E5E5] p-8">
                  <h2 className="text-lg font-semibold mb-2">Skill Gap Radar</h2>
                  <p className="text-[#999999] text-sm mb-8">Average score per concept area across all questions. Closer to 10 = stronger.</p>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                        <PolarGrid stroke="#E5E5E5" />
                        <PolarAngleAxis
                          dataKey="concept"
                          tick={{ fill: '#666666', fontSize: 11, fontWeight: 500 }}
                        />
                        <Radar
                          name="Score"
                          dataKey="score"
                          stroke="#000000"
                          fill="#000000"
                          fillOpacity={0.08}
                          strokeWidth={2}
                        />
                        <Tooltip
                          contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 0 }}
                          labelStyle={{ color: '#000000', fontWeight: 600 }}
                          formatter={(val: any) => [`${val}/10`, 'Avg Score']}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-[#E5E5E5]">
                    {radarData.map(d => (
                      <div key={d.concept} className="flex items-center gap-2">
                        <span className={`w-2 h-2 ${d.score >= 7 ? 'bg-black' : d.score >= 4 ? 'bg-[#999999]' : 'bg-[#CCCCCC]'}`} />
                        <span className="text-xs text-[#666666]">{d.concept} <span className="font-semibold text-black">{d.score}</span></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Critical Improvements */}
                <div className="border border-[#E5E5E5] p-8 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={18} className="text-[#D00000]" />
                    <h2 className="text-lg font-semibold">Critical Improvements</h2>
                  </div>
                  <p className="text-[#999999] text-sm mb-6">Areas that need immediate attention based on your lowest-scoring answers.</p>
                  <div className="space-y-4 flex-1">
                    {(() => {
                      const weakAreas = radarData
                        .filter(d => d.score < 6)
                        .sort((a, b) => a.score - b.score);
                      const allMissing = data.questions
                        .flatMap(q => q.answers[0]?.missingConcepts ?? [])
                        .reduce((acc: Record<string, number>, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {});
                      const topMissing = Object.entries(allMissing)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                      const weakQuestions = data.questions
                        .filter(q => (q.answers[0]?.score ?? 10) < 5)
                        .sort((a, b) => (a.answers[0]?.score ?? 0) - (b.answers[0]?.score ?? 0))
                        .slice(0, 3);

                      if (weakAreas.length === 0 && topMissing.length === 0 && weakQuestions.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center text-center py-8 flex-1">
                            <Award size={36} className="text-black mb-3" />
                            <p className="font-semibold text-black">Excellent performance!</p>
                            <p className="text-[#999999] text-sm mt-1">No critical weak spots detected. Keep it up!</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          {weakAreas.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-[#D00000] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <AlertCircle size={11} /> Weak Skill Areas
                              </p>
                              <div className="space-y-2">
                                {weakAreas.slice(0, 4).map(d => (
                                  <div key={d.concept} className="flex items-center justify-between border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
                                    <span className="text-sm font-medium text-[#333333]">{d.concept}</span>
                                    <span className="text-sm font-bold text-[#D00000]">{d.score}/10</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {topMissing.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Lightbulb size={11} /> Frequently Missing Concepts
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {topMissing.map(([concept, count]) => (
                                  <span key={concept} className="text-xs px-3 py-1.5 border border-[#E5E5E5] bg-[#FAFAFA] text-[#333333] flex items-center gap-1.5">
                                    {concept}
                                    <span className="text-[10px] text-[#999999] font-medium">×{count}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {weakQuestions.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Target size={11} /> Questions Needing Review
                              </p>
                              <div className="space-y-2">
                                {weakQuestions.map(q => (
                                  <div key={q.id} className="border border-[#E5E5E5] px-3 py-2">
                                    <p className="text-xs text-[#666666] line-clamp-2 mb-1">{q.questionText}</p>
                                    <span className="text-[10px] font-bold text-[#D00000]">Score: {q.answers[0]?.score ?? 0}/10</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab: Study Plan ── */}
        {activeTab === 'plan' && studyPlan && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Summary */}
            <div className="border border-[#E5E5E5] p-8">
              <p className="text-[10px] font-medium text-[#999999] uppercase tracking-widest mb-3">Assessment</p>
              <p className="text-[#666666] leading-relaxed">{studyPlan.summary}</p>
            </div>

            {/* Focus Areas */}
            <div className="border border-[#E5E5E5] p-8">
              <p className="text-[10px] font-medium text-black uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Zap size={12} /> Priority Focus Areas
              </p>
              <div className="flex flex-wrap gap-3">
                {studyPlan.focusAreas.map((area, i) => (
                  <span
                    key={area}
                    className="px-4 py-2 text-sm font-medium border border-[#E5E5E5] text-black bg-[#FAFAFA]"
                  >
                    #{i + 1} {area}
                  </span>
                ))}
              </div>
            </div>

            {/* 7-Day Plan */}
            <div className="border border-[#E5E5E5] p-8">
              <p className="text-[10px] font-medium text-black uppercase tracking-widest mb-6 flex items-center gap-1.5">
                <BookOpen size={12} /> 7-Day Action Plan
              </p>
              <div className="space-y-3">
                {studyPlan.dailyPlan.map((item) => (
                  <div key={item.day} className="flex items-start gap-4 group">
                    <div className="w-8 h-8 shrink-0 border border-[#E5E5E5] flex items-center justify-center text-xs font-semibold text-[#999999] group-hover:border-black group-hover:text-black transition-colors">
                      {item.day}
                    </div>
                    <p className="text-[#666666] text-sm leading-relaxed pt-1">{item.task}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Resources */}
            {studyPlan.resources?.length > 0 && (
              <div className="border border-[#E5E5E5] p-8">
                <p className="text-[10px] font-medium text-black uppercase tracking-widest mb-4">Recommended Resources</p>
                <div className="flex flex-wrap gap-3">
                  {studyPlan.resources.map(r => (
                    <span key={r} className="px-3 py-2 bg-[#FAFAFA] border border-[#E5E5E5] text-[#666666] text-sm">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Footer Actions */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 items-center justify-center border-t border-[#E5E5E5] pt-12">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-black hover:bg-[#222222] text-white font-medium px-8 py-3 transition-all"
          >
            Start New Interview
          </button>
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 border border-[#E5E5E5] hover:border-black text-black font-medium px-8 py-3 transition-all">
            <Download size={18} />
            Download PDF Report
          </button>
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 border border-[#E5E5E5] hover:border-black text-black font-medium px-8 py-3 transition-all">
            <Share2 size={18} />
            Share Progress
          </button>
        </div>
      </div>
    </div>
  );
}
