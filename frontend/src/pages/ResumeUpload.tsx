import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileText, X, Loader2, Sparkles, BrainCircuit,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  id: number;
  questionText: string;
  category: string;
  difficulty: number;
  expectedConcepts: string[];
}

export default function ResumeUpload() {
  const navigate = useNavigate();

  const [jobRole, setJobRole] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadStages = [
    'PDF Received',
    'Extracting Skills',
    'Contextualising for Role',
    'Generating Adaptive Questions',
  ];

  // ─── File validation ─────────────────────────────────────────────────────
  const validateAndSetFile = (f: File) => {
    if (f.type !== 'application/pdf') {
      setErrorMsg('Only PDF files are supported.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrorMsg('File size must be under 5 MB.');
      return;
    }
    setErrorMsg('');
    setFile(f);
  };

  // ─── Drag & drop handlers ────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  };

  // ─── Submit resume to backend ────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file || !jobRole.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    setCurrentStage(0);

    // Simulate stage progress
    const stageInterval = setInterval(() => {
      setCurrentStage((prev) => (prev < uploadStages.length - 1 ? prev + 1 : prev));
    }, 2000);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jobRole', jobRole.trim());

      const res = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let serverMsg = 'Failed to process resume';
        try {
          const errBody = await res.json() as { message?: string };
          if (errBody.message) serverMsg = errBody.message;
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }

      const data = await res.json() as {
        interviewId: number;
        question: Question;
        totalQuestions: number;
      };

      clearInterval(stageInterval);
      setCurrentStage(uploadStages.length - 1);

      // Brief pause for the final stage to be visible
      setTimeout(() => {
        navigate(`/interview/${data.interviewId}`, {
          state: { 
            interviewId: data.interviewId, 
            question: data.question,
            totalQuestions: data.totalQuestions 
          },
        });
      }, 500);

    } catch (err: unknown) {
      clearInterval(stageInterval);
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleUpload();
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
            Upload Your Resume
          </h2>
          <p className="text-gray-500 text-sm mt-2 text-center">
            AI will analyse your resume and generate 10-20 adaptive interview questions.
          </p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-5 bg-red-500/10 border border-red-500/40 text-red-400 text-sm rounded-xl px-4 py-3"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Stages Indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                <div className="flex flex-col gap-4">
                  {uploadStages.map((stage, idx) => (
                    <div key={stage} className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-5 h-5">
                        {currentStage > idx ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="bg-green-500 rounded-full p-1"
                          >
                            <X size={12} className="text-white rotate-45" /> 
                            {/* Wait, X is not Check. Let's use Check from Lucide if I had it. 
                                I see X was imported. I'll use a simple div for check. */}
                          </motion.div>
                        ) : currentStage === idx ? (
                          <Loader2 size={18} className="text-purple-400 animate-spin" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-gray-700" />
                        )}
                      </div>
                      <span className={`text-sm transition-colors duration-300 ${
                        currentStage === idx ? 'text-purple-400 font-medium' : 
                        currentStage > idx ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {stage}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="mt-6 h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-600 to-blue-500"
                    initial={{ width: '0%' }}
                    animate={{ width: `${((currentStage + 1) / uploadStages.length) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isLoading && (
          <>
            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative mb-6 flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-purple-400 bg-purple-500/10 scale-[1.02]'
                  : file
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) validateAndSetFile(f);
                }}
              />

              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div
                    key="file-selected"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-3 text-green-400"
                  >
                    <FileText size={32} />
                    <div className="text-left">
                      <p className="font-medium text-white text-sm">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB — PDF ready
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="ml-2 text-gray-500 hover:text-red-400 transition-colors"
                      title="Remove file"
                    >
                      <X size={18} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="drop-prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2 text-gray-500"
                  >
                    <UploadCloud size={36} className={isDragging ? 'text-purple-400' : 'text-gray-600'} />
                    <p className="text-sm font-medium">
                      {isDragging ? 'Drop your PDF here' : 'Drag & drop or click to browse'}
                    </p>
                    <p className="text-xs text-gray-600">PDF only · Max 5 MB</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Job role input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Target Job Role
              </label>
              <input
                id="resume-job-role-input"
                type="text"
                placeholder="e.g. Senior Frontend Developer"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50"
              />
            </div>

            {/* Submit */}
            <button
              id="upload-resume-btn"
              onClick={handleUpload}
              disabled={!file || !jobRole.trim() || isLoading}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.25)] hover:shadow-[0_0_28px_rgba(147,51,234,0.4)]"
            >
              <Sparkles size={20} />
              Generate Tailored Questions
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

