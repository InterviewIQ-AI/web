import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Send, Camera, CameraOff,
  Volume2, AlertCircle, Loader2, CheckCircle, LogOut, ArrowRight,
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isVoiceAnswerRef = useRef(false);
  const mimeTypeRef = useRef<string>('audio/webm');
  // Stores all answered Q&As for adaptive follow-up generation
  const answeredHistoryRef = useRef<Array<{ question: string; answer: string }>>([]);

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

  // ─── Voice Recording ──────────────────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setErrorMsg('');
    audioChunksRef.current = [];

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });

      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType || 'audio/webm';

      const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        audioStream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        await transcribeAudio(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      isVoiceAnswerRef.current = true;
      setIsRecording(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied.';
      setErrorMsg(msg);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      const ext = mimeTypeRef.current.includes('ogg')
        ? 'ogg'
        : mimeTypeRef.current.includes('mp4')
          ? 'mp4'
          : 'webm';
      formData.append('audio', audioBlob, `recording.${ext}`);

      const res = await fetch('/api/ai/transcribe', { method: 'POST', body: formData });
      if (!res.ok) {
        let serverMsg = 'Transcription failed on server';
        try {
          const e = await res.json() as { message?: string };
          if (e.message) serverMsg = e.message;
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }

      const data = await res.json() as { transcript: string };
      const transcript = data.transcript?.trim();
      if (transcript) {
        setAnswer((prev) => prev.trim() ? `${prev.trim()} ${transcript}` : transcript);
      }
    } catch (err: unknown) {
      setErrorMsg('Transcription failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── Speech Synthesis ─────────────────────────────────────────────────────
  const speakQuestion = useCallback(() => {
    if (!currentQuestion || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(currentQuestion.questionText);
    const applyVoice = (u: SpeechSynthesisUtterance) => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.name.toLowerCase().includes('google') && v.lang.startsWith('en')) ??
        voices.find((v) => v.lang === 'en-US') ??
        voices.find((v) => v.lang.startsWith('en')) ??
        null;
      if (preferred) u.voice = preferred;
    };

    applyVoice(utterance);
    if (!utterance.voice && window.speechSynthesis.getVoices().length === 0) {
      const onVoicesReady = () => {
        applyVoice(utterance);
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady);
        window.speechSynthesis.speak(utterance);
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady);
      return;
    }

    utterance.rate = 0.88;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') console.warn('SpeechSynthesis error:', e.error);
    };
    window.speechSynthesis.speak(utterance);
  }, [currentQuestion]);

  // ─── Submit Answer ────────────────────────────────────────────────────────
  const submitAnswer = async () => {
    if (!answer.trim() || !currentQuestion) return;

    setIsSubmitting(true);
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

      // Push to history for adaptive follow-up generation
      answeredHistoryRef.current.push({
        question: currentQuestion.questionText,
        answer: answer.trim(),
      });
      isVoiceAnswerRef.current = false;
    } catch (err: unknown) {
      setErrorMsg('Could not save answer: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
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
      }
    } catch { /* best-effort */ }
    navigate('/');
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
    TECHNICAL: 'bg-blue-500/10 text-blue-400',
    BEHAVIORAL: 'bg-green-500/10 text-green-400',
    SYSTEM_DESIGN: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row gap-6 p-6 bg-[#0a0a0f]">

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
          <button
            onClick={() => setCameraOn(!cameraOn)}
            className="absolute bottom-4 right-4 bg-gray-900/80 hover:bg-gray-700 text-white p-3 rounded-full backdrop-blur-md transition-colors z-10"
          >
            {cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
          </button>
        </div>

        {/* Status */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex-1">
          <h3 className="font-semibold text-lg mb-4 text-gray-200">Interview Status</h3>
          <div className="space-y-4 text-sm text-gray-400">
            <div className="flex justify-between items-center">
              <span>Question</span>
              <span className="font-medium text-purple-400">#{questionNumber}</span>
            </div>
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
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${categoryColor[currentQuestion.category] ?? 'bg-purple-500/10 text-purple-400'}`}
              >
                {currentQuestion.category.replace('_', ' ')}
              </span>
              <span className="text-xs text-gray-600">
                Difficulty: {'★'.repeat(currentQuestion.difficulty)}{'☆'.repeat(5 - currentQuestion.difficulty)}
              </span>
              <span className="ml-auto text-xs text-gray-600 font-mono">Q{questionNumber}</span>
            </div>
            <button
              onClick={speakQuestion}
              className="absolute top-8 right-8 text-gray-500 hover:text-purple-400 transition-colors bg-gray-800/50 p-2 rounded-full"
              title="Read Question Aloud"
            >
              <Volume2 size={20} />
            </button>
            <h2 className="text-2xl font-medium leading-relaxed text-gray-100 pr-12">
              {currentQuestion.questionText}
            </h2>
          </motion.div>
        </AnimatePresence>

        {/* Answer Area — hidden after evaluation */}
        {!evaluation ? (
          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col relative shadow-lg min-h-[260px]">
            <div className="flex justify-between items-center mb-2 min-h-[28px]">
              {isRecording && (
                <div className="flex items-center gap-2 text-red-400 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium">Recording Audio…</span>
                </div>
              )}
              {isTranscribing && (
                <div className="flex items-center gap-2 text-purple-400 ml-auto">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-medium">Transcribing via AI…</span>
                </div>
              )}
            </div>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={isTranscribing || isSubmitting}
              placeholder={
                isTranscribing
                  ? 'Transcribing your audio…'
                  : 'Your voice answer will appear here, or you can type it…'
              }
              className="w-full flex-1 bg-transparent resize-none outline-none text-gray-200 placeholder-gray-600 text-lg leading-relaxed mt-2 disabled:opacity-50"
            />

            <div className="flex justify-between items-center border-t border-gray-800 pt-4 mt-4">
              <button
                onClick={toggleRecording}
                disabled={isTranscribing || isSubmitting}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  isRecording
                    ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20'
                    : 'bg-purple-600 text-white hover:bg-purple-500'
                }`}
              >
                {isRecording ? (
                  <><MicOff size={20} /><span>Stop &amp; Transcribe</span></>
                ) : (
                  <><Mic size={20} /><span>Start Voice Answer</span></>
                )}
              </button>

              <button
                onClick={submitAnswer}
                disabled={!answer.trim() || isTranscribing || isSubmitting || isRecording}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors font-medium border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <><Loader2 size={18} className="animate-spin" /><span>Saving…</span></>
                ) : (
                  <><span>Submit</span><Send size={18} /></>
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

            {/* Next Question + End Interview buttons */}
            <div className="flex gap-3 pt-1">
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

              <button
                onClick={handleEndInterview}
                disabled={isFetchingNext || isEnding}
                className="flex items-center gap-2 bg-gray-800 hover:bg-red-500/20 hover:border-red-500/50 border border-gray-700 text-gray-400 hover:text-red-400 px-5 py-3 rounded-xl transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isEnding ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <><LogOut size={18} /><span>End Interview</span></>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
