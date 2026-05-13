import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Send, Camera, CameraOff,
  Volume2, AlertCircle, Loader2, CheckCircle, LogOut, ArrowRight,
  Code, User, Briefcase,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Cross-browser MIME type detection ───────────────────────────────────────
function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Question {
  id: number;
  questionText: string;
  category: string;
  difficulty: number;
  expectedConcepts: string[];
}

interface LocationState {
  interviewId: number;
  question: Question;
  totalQuestions: number;
}

interface Evaluation {
  score: number;
  feedback: string;
  missingConcepts: string[];
  idealAnswerComparison: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function InterviewRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const interviewId = state?.interviewId ?? null;

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(
    state?.question ?? null,
  );
  const totalQuestions = state?.totalQuestions ?? 10;
  const [questionNumber, setQuestionNumber] = useState(1);
  const [answer, setAnswer] = useState('');
  const [cameraOn, setCameraOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // ─── Voice Settings ───
  const [showSettings, setShowSettings] = useState(false);
  const [voiceRate, setVoiceRate] = useState(0.85);
  const [voicePitch, setVoicePitch] = useState(0.9);
  const [autoRead, setAutoRead] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isVoiceAnswerRef = useRef(false);
  const mimeTypeRef = useRef<string>('audio/webm');
  // Stores all answered Q&As for adaptive follow-up generation
  const answeredHistoryRef = useRef<Array<{ question: string; answer: string }>>([]);

  const isSubmittingRef = useRef(false);
  const evaluationRef = useRef<Evaluation | null>(null);

  // Reset answer/evaluation when moving to a new question
  useEffect(() => {
    setAnswer('');
    setEvaluation(null);
    setStartTime(Date.now());
    window.speechSynthesis.cancel();
  }, [currentQuestion?.id]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // Camera setup
  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setErrorMsg('');
        })
        .catch(() => {
          setIsSubmitting(true);
          isSubmittingRef.current = true;
          // Stop any active continuous recording
          recognitionRef.current?.stop();
          setIsRecording(false);
          setErrorMsg('Could not access camera. Check permissions.');
          setCameraOn(false);
        });
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn]);

  const recognitionRef = useRef<any>(null);

  // ─── Voice Recording (Real-time & Continuous) ─────────────────────────────
  const startContinuousListening = useCallback(() => {
    if (evaluationRef.current || isSubmittingRef.current) return;

    // Use Web Speech API for real-time word-by-word feedback
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Indian English for better local accent support

    recognition.onstart = () => {
      console.log('Microphone is LIVE');
      setIsRecording(true);
      isVoiceAnswerRef.current = true;
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const rawText = (finalTranscript + interimTranscript).trim();
      console.log('Voice Data:', rawText);

      // --- Filter out question repetition ---
      const cleanText = (text: string, question: string) => {
        const tNorm = text.toLowerCase().replace(/[^\w\s]/g, '');
        const qNorm = question.toLowerCase().replace(/[^\w\s]/g, '');
        
        // If it starts with the question, we strip the question part
        if (qNorm.length > 0 && tNorm.startsWith(qNorm.substring(0, Math.min(15, qNorm.length)))) {
           if (tNorm.length <= qNorm.length + 5) return ''; 
           return text.substring(question.length).trim();
        }
        return text;
      };

      const filteredText = cleanText(rawText, currentQuestion?.questionText || '');
      
      if (filteredText) {
        setAnswer(filteredText);
      } else if (rawText.length > (currentQuestion?.questionText.length || 0) + 5) {
        // Fallback: if filtering seems wrong but we have lots of text, show it anyway
        setAnswer(rawText);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Restart if still in answering phase
      if (!evaluationRef.current && !isSubmittingRef.current) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [currentQuestion]);

  // ─── Speech Synthesis (humanized) ────────────────────────────────────────
  const speakQuestion = useCallback(() => {
    if (!currentQuestion || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const applyVoice = (u: SpeechSynthesisUtterance) => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        // Prefer Indian English (en-IN)
        voices.find((v) => v.lang === 'en-IN' && v.name.toLowerCase().includes('google')) ??
        voices.find((v) => v.lang === 'en-IN') ??
        // Fallbacks
        voices.find((v) => v.name.toLowerCase().includes('google') && v.lang.startsWith('en')) ??
        voices.find((v) => v.lang === 'en-US') ??
        voices.find((v) => v.lang.startsWith('en')) ??
        null;
      if (preferred) u.voice = preferred;
    };

    const silentHandler = (e: SpeechSynthesisErrorEvent) => {
      if (e.error !== 'interrupted') console.warn('SpeechSynthesis error:', e.error);
    };

    // Question: custom rate/pitch from settings
    const questionU = new SpeechSynthesisUtterance(currentQuestion.questionText);
    applyVoice(questionU);
    questionU.rate = voiceRate;
    questionU.pitch = voicePitch;
    questionU.volume = 1.0;
    questionU.onerror = silentHandler;

    // Start listening as soon as the question finishes speaking
    questionU.onend = () => { startContinuousListening(); };

    const startSpeaking = () => {
      applyVoice(questionU);
      window.speechSynthesis.speak(questionU);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      const onVoicesReady = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady);
        startSpeaking();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady);
      return;
    }

    startSpeaking();
  }, [currentQuestion, startContinuousListening, voiceRate, voicePitch]);

  // Automatically speak the question after a 2-second delay when it appears
  useEffect(() => {
    if (!autoRead) return;
    const timer = setTimeout(() => {
      speakQuestion();
    }, 2000);
    return () => clearTimeout(timer);
  }, [speakQuestion, autoRead]);

  // ─── Submit Answer ────────────────────────────────────────────────────────
  const submitAnswer = async () => {
    if (!answer.trim() || !currentQuestion) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    setErrorMsg('');
    const timeTakenSeconds = Math.round((Date.now() - startTime) / 1000);

    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          userAnswer: answer.trim(),
          isVoice: isVoiceAnswerRef.current,
          timeTakenSeconds,
        }),
      });

      if (!res.ok) {
        let serverMsg = 'Failed to save answer';
        try {
          const e = await res.json() as { message?: string };
          if (e.message) serverMsg = e.message;
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }

      const data = await res.json() as { evaluation: Evaluation };
      setEvaluation(data.evaluation);
      evaluationRef.current = data.evaluation;

      // Push to history for adaptive follow-up generation
      answeredHistoryRef.current.push({
        question: currentQuestion.questionText,
        answer: answer.trim(),
      });
      isVoiceAnswerRef.current = false;
      recognitionRef.current?.stop();
    } catch (err: unknown) {
      setErrorMsg('Could not save answer: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // ─── Next Question (adaptive) ─────────────────────────────────────────────
  const handleNextQuestion = async () => {
    setIsFetchingNext(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/interview/${interviewId}/next-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: answeredHistoryRef.current }),
      });

      if (!res.ok) throw new Error('Failed to fetch next question');
      const data = await res.json() as { question: Question };
      setCurrentQuestion(data.question);
      setQuestionNumber((n) => n + 1);
    } catch (err: unknown) {
      setErrorMsg('Could not load next question. Please try again.');
    } finally {
      setIsFetchingNext(false);
    }
  };

  // ─── End Interview ────────────────────────────────────────────────────────
  const handleEndInterview = async () => {
    setIsEnding(true);
    try {
      if (interviewId) {
        await fetch(`/api/interview/${interviewId}/complete`, { method: 'POST' });
        navigate(`/results/${interviewId}`);
      } else {
        navigate('/');
      }
    } catch { 
      navigate('/');
    }
  };

  // ─── Guard ────────────────────────────────────────────────────────────────
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#0a0a0f]">
        <div className="text-center text-gray-400 space-y-4">
          <AlertCircle size={48} className="mx-auto text-yellow-400" />
          <p className="text-xl font-medium">No interview session found.</p>
          <p className="text-sm">Please go back and start an interview first.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const categoryColor: Record<string, string> = {
    TECHNICAL: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    MR: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    BEHAVIORAL: 'bg-green-500/20 text-green-400 border-green-500/30',
    SYSTEM_DESIGN: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row gap-6 p-6 bg-[#0a0a0f]">

      {/* ── Settings Modal ── */}
      <AnimatePresence>
        {showSettings && (
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
              className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-[2rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Briefcase size={22} className="text-purple-400" />
                  Voice Settings
                </h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Auto Read Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-200">Auto-read Questions</p>
                    <p className="text-xs text-gray-500">AI will speak as soon as the question appears.</p>
                  </div>
                  <button 
                    onClick={() => setAutoRead(!autoRead)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${autoRead ? 'bg-purple-600' : 'bg-gray-800'}`}
                  >
                    <motion.div 
                      animate={{ x: autoRead ? 26 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Voice Rate */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-bold text-gray-200">Speaking Speed</p>
                    <span className="text-xs font-mono text-purple-400">{voiceRate.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.05"
                    value={voiceRate}
                    onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 bg-gray-800 rounded-lg h-1.5 appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-2 font-bold uppercase tracking-widest">
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>

                {/* Voice Pitch */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-bold text-gray-200">Voice Pitch</p>
                    <span className="text-xs font-mono text-purple-400">{voicePitch.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.05"
                    value={voicePitch}
                    onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                    className="w-full accent-purple-500 bg-gray-800 rounded-lg h-1.5 appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-2 font-bold uppercase tracking-widest">
                    <span>Deep</span>
                    <span>High</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  speakQuestion();
                  setShowSettings(false);
                }}
                className="w-full mt-10 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Volume2 size={20} />
                Test Voice & Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left Panel ── */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm shadow-lg backdrop-blur-sm">
            <AlertCircle size={16} />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Camera */}
        <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 flex items-center justify-center shadow-lg">
          {cameraOn ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
              />
              <span className="absolute bottom-4 left-4 text-xs font-medium bg-black/50 px-2 py-1 rounded text-white backdrop-blur-md">
                You
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center text-gray-600">
              <CameraOff className="w-16 h-16 mb-2" />
              <span>Camera Disabled</span>
            </div>
          )}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="bg-gray-900/80 hover:bg-gray-700 text-white p-3 rounded-full backdrop-blur-md transition-colors z-10"
              title="Voice Settings"
            >
              <Briefcase size={20} />
            </button>
            <button
              onClick={() => setCameraOn(!cameraOn)}
              className="bg-gray-900/80 hover:bg-gray-700 text-white p-3 rounded-full backdrop-blur-md transition-colors z-10"
            >
              {cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex-1">
          <h3 className="font-semibold text-lg mb-4 text-gray-200">Interview Status</h3>
          <div className="space-y-4 text-sm text-gray-400">

            {interviewId && (
              <div className="flex justify-between items-center">
                <span>Interview ID</span>
                <span className="font-mono text-gray-500">#{interviewId}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>Answered</span>
              <span className="font-medium text-green-400">
                {answeredHistoryRef.current.length} question{answeredHistoryRef.current.length !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Pulsing "live" indicator */}
            <div className="flex items-center gap-2 pt-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
              </span>
              <span className="text-xs text-gray-500">Interview in progress</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="w-full md:w-2/3 flex flex-col gap-4">

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-lg relative"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${categoryColor[currentQuestion.category] ?? 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                {currentQuestion.category === 'TECHNICAL' && <Code size={14} />}
                {currentQuestion.category === 'HR' && <User size={14} />}
                {currentQuestion.category === 'MR' && <Briefcase size={14} />}
                <span className="text-xs font-bold tracking-wider">
                  {currentQuestion.category}
                </span>
              </div>
              <span className="text-xs text-gray-600">
                Difficulty: {'★'.repeat(currentQuestion.difficulty)}{'☆'.repeat(5 - currentQuestion.difficulty)}
              </span>

            </div>
            <button
              onClick={speakQuestion}
              className="absolute top-8 right-8 text-gray-500 hover:text-purple-400 transition-colors bg-gray-800/50 p-2 rounded-full"
              title="Read Question Aloud"
            >
              <Volume2 size={20} />
            </button>
            <h2 className="text-2xl font-bold text-white leading-relaxed pr-12">
              {currentQuestion.questionText}
            </h2>
          </motion.div>
        </AnimatePresence>

        {/* Answer Area — hidden after evaluation */}
        {!evaluation ? (
          <div className="flex-1 flex flex-col gap-6">
            <div className="relative group">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="The interviewer is listening... your words will appear here as you speak."
                className="w-full h-[450px] min-h-[400px] bg-gray-900/50 border border-gray-700 rounded-xl p-5 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none text-lg leading-relaxed group-hover:border-gray-600 shadow-inner"
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-3">
                {isRecording && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-full border border-red-500/30">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-red-400 uppercase tracking-wider">Listening</span>
                  </div>
                )}
                <span className={`text-xs font-medium font-mono ${answer.length > 500 ? 'text-orange-400' : 'text-gray-500'}`}>
                  {answer.length} chars
                </span>
              </div>
            </div>

            <div className="flex justify-end items-center gap-4">
              {/* Fallback Manual Microphone Button */}
              {!isRecording && (
                <button
                  onClick={startContinuousListening}
                  className="flex items-center gap-2 text-gray-500 hover:text-purple-400 transition-colors text-xs font-medium border border-gray-800 px-3 py-1.5 rounded-lg"
                >
                  <Mic size={14} />
                  <span>Mic didn't start? Click to Listen</span>
                </button>
              )}

              <button
                onClick={submitAnswer}
                disabled={!answer.trim() || isSubmitting || isRecording}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-10 py-4 rounded-xl transition-all font-bold shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transform active:scale-95 border border-purple-400/30"
              >
                {isSubmitting ? (
                  <><Loader2 size={20} className="animate-spin" /><span>Evaluating...</span></>
                ) : (
                  <><span>Submit Answer</span><Send size={20} /></>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Evaluation Result */
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-lg space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                <CheckCircle size={22} className="text-green-400" />
                Answer Saved &amp; Evaluated
              </h3>
              <span
                className={`text-3xl font-bold ${
                  evaluation.score >= 8
                    ? 'text-green-400'
                    : evaluation.score >= 5
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {evaluation.score}/10
              </span>
            </div>

            <div className="bg-gray-800/40 rounded-xl p-4 text-sm text-gray-300 leading-relaxed border border-gray-700/30 italic">
              <p className="font-medium text-gray-500 mb-1 text-xs uppercase tracking-wider not-italic">Your Response</p>
              "{answer}"
            </div>

            <div className="bg-gray-800/60 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
              <p className="font-medium text-gray-400 mb-1 text-xs uppercase tracking-wider">AI Feedback</p>
              {evaluation.feedback}
            </div>

            {evaluation.missingConcepts?.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Missing Concepts</p>
                <div className="flex flex-wrap gap-2">
                  {evaluation.missingConcepts.map((c) => (
                    <span
                      key={c}
                      className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-1 rounded-full"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-800/60 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
              <p className="font-medium text-gray-400 mb-1 text-xs uppercase tracking-wider">Ideal Answer Comparison</p>
              {evaluation.idealAnswerComparison}
            </div>

            {/* Next Question / End Interview buttons */}
            <div className="flex gap-3 pt-1">
              {questionNumber < 30 ? (
                <button
                  onClick={handleNextQuestion}
                  disabled={isFetchingNext || isEnding}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all"
                >
                  {isFetchingNext ? (
                    <><Loader2 size={18} className="animate-spin" /><span>Generating Next Question…</span></>
                  ) : (
                    <><span>Next Question</span><ArrowRight size={18} /></>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleEndInterview}
                  disabled={isEnding}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                >
                  {isEnding ? (
                    <><Loader2 size={18} className="animate-spin" /><span>Evaluating Final Score…</span></>
                  ) : (
                    <><span>Finish Interview &amp; Get Results</span><CheckCircle size={18} /></>
                  )}
                </button>
              )}

              {questionNumber < totalQuestions && (
                <button
                  onClick={handleEndInterview}
                  disabled={isFetchingNext || isEnding}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-red-500/20 hover:border-red-500/50 border border-gray-700 text-gray-400 hover:text-red-400 px-5 py-3 rounded-xl transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isEnding ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <><LogOut size={18} /><span>Exit Early</span></>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
