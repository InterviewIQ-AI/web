import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface Question {
  id: number;
  questionText: string;
  category: string;
  difficulty: number;
  expectedConcepts: string[];
}

export default function Dashboard() {
  const [jobRole, setJobRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

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

      const data = await res.json() as {
        interviewId: number;
        questions: Question[];
      };

      // Navigate to interview room with the DB-persisted questions
      navigate(`/interview/${data.interviewId}`, {
        state: { interviewId: data.interviewId, questions: data.questions },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleStart();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-xl bg-gray-900/80 backdrop-blur border border-gray-800 rounded-3xl p-10 shadow-2xl z-10"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-purple-500/10 rounded-2xl mb-4">
            <BrainCircuit size={36} className="text-purple-400" />
          </div>
          <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Start Your Interview
          </h2>
          <p className="text-gray-500 text-sm mt-2 text-center">
            AI will generate 5 tailored questions and save them to your session.
          </p>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mb-5 bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl px-4 py-3">
            {errorMsg}
          </div>
        )}

        {/* Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Target Job Role
          </label>
          <input
            id="job-role-input"
            type="text"
            placeholder="e.g. Senior Frontend Developer"
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50"
          />
        </div>

        {/* Button */}
        <button
          id="start-interview-btn"
          onClick={handleStart}
          disabled={!jobRole.trim() || isLoading}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.25)] hover:shadow-[0_0_28px_rgba(147,51,234,0.4)]"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Generating &amp; Saving Questions…
            </>
          ) : (
            <>
              <Sparkles size={20} />
              Generate Interview Questions
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
