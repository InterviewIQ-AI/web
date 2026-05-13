import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle, AlertCircle, ArrowLeft, Download, Share2, 
  Target, Award, Clock, MessageSquare, ChevronRight, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Answer {
  id: number;
  userAnswer: string;
  score: number;
  feedback: string;
  missingConcepts: string[];
  timeTakenSeconds: number;
}

interface Question {
  id: number;
  questionText: string;
  category: string;
  difficulty: number;
  answers: Answer[];
}

interface InterviewData {
  id: number;
  jobRole: string;
  finalScore: number;
  feedbackSummary: string;
  createdAt: string;
  questions: Question[];
}

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/interview/${id}`);
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-8">
        <div className="text-center space-y-4">
          <AlertCircle size={64} className="mx-auto text-red-500" />
          <h2 className="text-2xl font-bold text-white">Oops! Could not load results</h2>
          <p className="text-gray-400 max-w-md mx-auto">{error || "The interview session was not found."}</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-gray-800 text-white px-6 py-2 rounded-xl border border-gray-700 hover:bg-gray-700 transition-all"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/10 border-green-500/20';
    if (score >= 5) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-20 overflow-x-hidden">
      {/* Background decoration */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-12 relative z-10">
        {/* Navigation */}
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold tracking-widest rounded-full uppercase">
                Interview Report
              </span>
              <span className="text-gray-500 text-sm">
                {new Date(data.createdAt).toLocaleDateString('en-US', { 
                  month: 'long', day: 'numeric', year: 'numeric' 
                })}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {data.jobRole}
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
              {data.feedbackSummary}
            </p>
          </div>

          {/* Overall Score Circle */}
          <div className="flex flex-col items-center bg-gray-900/50 backdrop-blur-xl border border-gray-800 p-8 rounded-[2.5rem] shadow-2xl">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-800"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray="364.4"
                  initial={{ strokeDashoffset: 364.4 }}
                  animate={{ strokeDashoffset: 364.4 - (364.4 * (data.finalScore || 0)) / 10 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={getScoreColor(data.finalScore || 0)}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-bold">{data.finalScore || 0}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">/ 10</span>
              </div>
            </div>
            <span className="mt-4 font-bold text-xs uppercase tracking-[0.2em] text-gray-500">Overall Score</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-gray-900/40 border border-gray-800/50 p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
              <Target size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Questions</p>
              <p className="text-xl font-bold">{data.questions.length}</p>
            </div>
          </div>
          <div className="bg-gray-900/40 border border-gray-800/50 p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400">
              <Award size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Strong Points</p>
              <p className="text-xl font-bold">{data.questions.filter(q => q.answers[0]?.score >= 8).length}</p>
            </div>
          </div>
          <div className="bg-gray-900/40 border border-gray-800/50 p-6 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Completion</p>
              <p className="text-xl font-bold">100%</p>
            </div>
          </div>
        </div>

        {/* Questions Breakdown */}
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <MessageSquare className="text-purple-400" size={24} />
          Session Breakdown
        </h2>

        <div className="space-y-4">
          {data.questions.map((q, idx) => {
            const answer = q.answers[0];
            const isExpanded = expandedQuestion === q.id;

            return (
              <motion.div 
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden shadow-lg"
              >
                {/* Header/Summary */}
                <div 
                  onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                  className="p-6 cursor-pointer hover:bg-gray-800/30 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex-1 flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-200 mb-1 leading-tight">{q.questionText}</h3>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 uppercase tracking-widest border border-gray-700">
                          {q.category}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          {answer?.timeTakenSeconds || 0}s response
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <div className={`px-4 py-1.5 rounded-xl border text-sm font-bold ${getScoreBg(answer?.score || 0)} ${getScoreColor(answer?.score || 0)}`}>
                      {answer?.score || 0}/10
                    </div>
                    {isExpanded ? <ChevronDown size={20} className="text-gray-600" /> : <ChevronRight size={20} className="text-gray-600" />}
                  </div>
                </div>

                {/* Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-gray-950/30"
                    >
                      <div className="p-6 pt-0 border-t border-gray-800/50 space-y-6">
                        <div className="mt-6">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Your Answer</p>
                          <div className="text-gray-300 text-sm leading-relaxed italic bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                            "{answer?.userAnswer || "No answer recorded."}"
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">AI Feedback</p>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {answer?.feedback || "Evaluation pending."}
                          </p>
                        </div>

                        {answer?.missingConcepts?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Missing Concepts</p>
                            <div className="flex flex-wrap gap-2">
                              {answer.missingConcepts.map(c => (
                                <span key={c} className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-1 rounded-md border border-red-500/20 uppercase tracking-wider">
                                  {c}
                                </span>
                              ))}
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

        {/* Footer Actions */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 items-center justify-center border-t border-gray-800 pt-12">
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-black font-bold px-8 py-3 rounded-xl hover:bg-gray-200 transition-all">
            <Download size={20} />
            Download PDF Report
          </button>
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-900 border border-gray-800 text-white font-bold px-8 py-3 rounded-xl hover:bg-gray-800 transition-all">
            <Share2 size={20} />
            Share Progress
          </button>
        </div>
      </div>
    </div>
  );
}
