import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Camera, CameraOff,
  Volume2, AlertCircle, Loader2, LogOut,
  Code, User, X, Lightbulb, Pause, Play,
  CheckCircle2, Settings, Send, Edit3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  roundType?: string;
  difficulty?: string;
  jobRole?: string;
}

interface Evaluation {
  score: number;
  feedback: string;
  idealAnswer?: string;
  missingConcepts: string[];
  behavioralFeedback?: {
    eyeContact: string;
    posture: string;
    confidence: string;
    overall: string;
  };
}

const EVAL_TIPS = [
  'Evaluating your answer…',
  'Checking key concepts…',
  'Analysing your response…',
  'Preparing your next question…',
  'Scoring your answer…',
  'Almost ready…',
];

const TRIGGER_PHRASES = [
  "that's all", "thats all", "that is all",
  "i'm done", "im done", "i am done",
  "that's it", "thats it", "that is it",
  "submit answer", "submit",
  "i'm finished", "im finished", "i am finished",
  "that's my answer", "thats my answer",
  "that's everything", "thats everything",
  "end answer", "done",
  "thank you", "thanks",
];

// ─── Audio Visualizer ─────────────────────────────────────────────────────────
function AudioBars({ active, color = '#22c55e', bars = 5 }: { active: boolean; color?: string; bars?: number }) {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          style={{ background: color, width: 3, borderRadius: 2 }}
          animate={active ? { height: ['4px', `${8 + (i % 3) * 5 + 4}px`, '4px'] } : { height: '4px' }}
          transition={active ? { duration: 0.5 + i * 0.08, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function InterviewRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, dbUser } = useAuth();
  const state = location.state as LocationState | null;

  const interviewId =
    state?.interviewId ?? (localStorage.getItem('active_interview_id')
      ? parseInt(localStorage.getItem('active_interview_id')!)
      : null);

  const roundType = state?.roundType ?? 'TR';
  const difficulty = state?.difficulty ?? 'medium';
  const jobRole = state?.jobRole ?? 'Interview';

  // ─── State ────────────────────────────────────────────────────────────────
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(state?.question ?? null);
  const totalQuestions = state?.totalQuestions ?? 10;
  const [questionNumber, setQuestionNumber] = useState(1);
  const [answer, setAnswer] = useState('');
  const [cameraOn, setCameraOn] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);      // user-controlled mic toggle
  const [isRecording, setIsRecording] = useState(false);   // actual recognition running state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [evalTipIndex, setEvalTipIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceRate, setVoiceRate] = useState(0.85);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [autoRead, setAutoRead] = useState(true);
  const [micError, setMicError] = useState('');
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const [showMicModal, setShowMicModal] = useState(false);

  // Timer
  const QUESTION_TIME = 120;
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);

  // ─── Refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isVoiceAnswerRef = useRef(false);
  const answeredHistoryRef = useRef<Array<{ question: string; answer: string }>>([]);
  const isSubmittingRef = useRef(false);
  const evaluationRef = useRef<Evaluation | null>(null);
  const answerRef = useRef('');
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const evalTipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedTranscriptRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const lastSpokenIdRef = useRef<number | null>(null);
  const submitAnswerRef = useRef<(override?: string) => Promise<void>>(() => Promise.resolve());
  const isPausedRef = useRef(false);
  const micEnabledRef = useRef(true);
  const micStartedRef = useRef(false); // tracks whether recognition has started for current question
  const micFailsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Render-time ref assignments (always fresh closures, no effect needed) ─
  // This pattern avoids stale closure problems without useCallback deps.
  // Reading these refs anywhere gives the latest state values.
  const speakImplRef = useRef<() => void>(() => {});
  const listenImplRef = useRef<() => void>(() => {});

  // ─── keep micEnabled in ref so recognition onend can read it ──────────────
  micEnabledRef.current = micEnabled;
  isPausedRef.current = isPaused;
  answerRef.current = answer;

  // ─── Voice helper — always fresh via render-time assignment ───────────────
  speakImplRef.current = () => {
    if (!currentQuestion || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    const getVoice = () => {
      const vs = window.speechSynthesis.getVoices();
      return (
        vs.find(v => v.name.toLowerCase().includes('google uk english female')) ??
        vs.find(v => v.name.toLowerCase().includes('google us english female')) ??
        vs.find(v => v.name.toLowerCase().includes('microsoft zira')) ??
        vs.find(v => v.name.toLowerCase().includes('microsoft aria')) ??
        vs.find(v => v.lang === 'en-GB') ??
        vs.find(v => v.lang === 'en-US') ??
        vs.find(v => v.lang.startsWith('en')) ??
        null
      );
    };

    // Snapshot the question NOW (at render time) — matches exactly what typewriter shows
    const questionText = currentQuestion.questionText;
    const questionId = currentQuestion.id;

    if (lastSpokenIdRef.current === questionId) return;
    lastSpokenIdRef.current = questionId;

    const doSpeak = () => {
      const u = new SpeechSynthesisUtterance(questionText);
      const v = getVoice();
      if (v) u.voice = v;
      u.rate = voiceRate;
      u.pitch = voicePitch;
      u.volume = 1.0;

      u.onstart = () => {
        setIsSpeaking(true);
        // Start typewriter exactly when voice starts — they stay in sync
        // Speed: ~70ms/char matches speech at rate 0.85 (~2.5 words/sec, ~12 chars/sec)
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        let charIdx = 0;
        setDisplayedText('');
        setIsTyping(true);
        typewriterRef.current = setInterval(() => {
          charIdx++;
          setDisplayedText(questionText.slice(0, charIdx));
          if (charIdx >= questionText.length) {
            clearInterval(typewriterRef.current!);
            setIsTyping(false);
          }
        }, 70);
      };
      u.onend = () => {
        setIsSpeaking(false);
        // Ensure full text is visible even if typewriter didn't finish
        setDisplayedText(questionText);
        setIsTyping(false);
        if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
        // Start mic
        if (micFailsafeRef.current) { clearTimeout(micFailsafeRef.current); micFailsafeRef.current = null; }
        if (micEnabledRef.current && !isPausedRef.current && !micStartedRef.current) {
          micStartedRef.current = true;
          setTimeout(() => listenImplRef.current(), 400);
        }
      };
      u.onerror = (e) => {
        console.warn('TTS error:', e.error);
        setIsSpeaking(false);
        // Show full text immediately on error
        setDisplayedText(questionText);
        setIsTyping(false);
        if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
        if (micFailsafeRef.current) { clearTimeout(micFailsafeRef.current); micFailsafeRef.current = null; }
        if (micEnabledRef.current && !isPausedRef.current && !micStartedRef.current) {
          micStartedRef.current = true;
          setTimeout(() => listenImplRef.current(), 200);
        }
      };

      // Simple 300ms delay — gives Chrome's AudioContext time to activate
      // More reliable than primer since primer at rate=10 may not fire onend
      setTimeout(() => {
        if (lastSpokenIdRef.current !== questionId) return;
        const freshV = getVoice();
        if (freshV) u.voice = freshV;
        window.speechSynthesis.speak(u);
      }, 300);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      const onReady = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onReady);
        doSpeak();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onReady);
    } else {
      doSpeak();
    }
  };

  // ─── Listen helper — always fresh via render-time assignment ──────────────
  listenImplRef.current = () => {
    if (evaluationRef.current || isSubmittingRef.current || !micEnabledRef.current) return;
    setMicError('');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    // Stop any existing instance completely before creating new one
    if (recognitionRef.current) {
      const old = recognitionRef.current;
      old.onend = null;
      old.onerror = null;
      old.onresult = null;
      try { old.stop(); } catch {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let lastFinalText = '';

    recognition.onstart = () => {
      setIsRecording(true);
      isVoiceAnswerRef.current = true;
    };

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalText += (finalText ? ' ' : '') + event.results[i][0].transcript.trim();
        } else {
          interimText += (interimText ? ' ' : '') + event.results[i][0].transcript.trim();
        }
      }
      lastFinalText = finalText;

      const combined = [accumulatedTranscriptRef.current, finalText, interimText]
        .map(t => t.trim()).filter(Boolean).join(' ');

      setAnswer(combined);

      // Auto-submit on trigger phrase
      if (finalText) {
        const norm = combined.toLowerCase().replace(/[.,!?;:\s]+$/, '').trimEnd();
        const hit = TRIGGER_PHRASES.find(p => norm.endsWith(p));
        if (hit && !evaluationRef.current && !isSubmittingRef.current) {
          const cutIdx = norm.lastIndexOf(hit);
          const stripped = combined.slice(0, cutIdx).replace(/[,.\s]+$/, '').trim();
          recognition.onend = null;
          try { recognition.stop(); } catch {}
          recognitionRef.current = null;
          setIsRecording(false);
          const finalAnswer = stripped || accumulatedTranscriptRef.current.trim();
          if (finalAnswer) {
            setAnswer(finalAnswer);
            setAutoSubmitTriggered(true);
            void submitAnswerRef.current(finalAnswer);
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (lastFinalText.trim()) {
        accumulatedTranscriptRef.current = [accumulatedTranscriptRef.current, lastFinalText]
          .map(t => t.trim()).filter(Boolean).join(' ');
        lastFinalText = '';
      }
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          setShowMicModal(true);
          break;
        case 'no-speech':
        case 'aborted':
          break;
        case 'audio-capture':
          setMicError('No microphone detected.');
          break;
        default:
          console.warn('Recognition error:', event.error);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (lastFinalText.trim()) {
        accumulatedTranscriptRef.current = [accumulatedTranscriptRef.current, lastFinalText]
          .map(t => t.trim()).filter(Boolean).join(' ');
        lastFinalText = '';
      }
      setIsRecording(false);
      // Only auto-restart if this is still the active recognition AND mic is still enabled
      if (
        recognitionRef.current === recognition &&
        micEnabledRef.current &&
        !evaluationRef.current &&
        !isSubmittingRef.current &&
        !isPausedRef.current
      ) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (e) { console.error('Recognition start failed:', e); }
  };

  // ─── Full cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      window.speechSynthesis.cancel();
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      if (evalTipIntervalRef.current) clearInterval(evalTipIntervalRef.current);
      if (micFailsafeRef.current) clearTimeout(micFailsafeRef.current);
    };
  }, []);

  // ─── Preload voices on mount so they're ready when first question arrives ──
  useEffect(() => {
    const tryLoad = () => {
      if (window.speechSynthesis.getVoices().length > 0) return;
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        // Just trigger load — voices are now cached by the browser
        window.speechSynthesis.getVoices();
      }, { once: true });
      // Trigger Chrome to start loading voices
      window.speechSynthesis.getVoices();
    };
    tryLoad();
  }, []);

  useEffect(() => {
    if (!currentQuestion) return;

    // Reset state for new question
    setAnswer('');
    evaluationRef.current = null;
    isSubmittingRef.current = false;
    accumulatedTranscriptRef.current = '';
    setStartTime(Date.now());
    setIsFollowUp(false);
    setAutoSubmitTriggered(false);
    setIsSpeaking(false);
    setIsRecording(false);
    window.speechSynthesis.cancel();
    // NOTE: do NOT reset lastSpokenIdRef here — speakImplRef guards by question ID.
    // Resetting it would cause React Strict Mode's double-invoke to speak twice.

    // Kill any existing recognition
    if (recognitionRef.current) {
      const old = recognitionRef.current;
      old.onend = null;
      old.onerror = null;
      old.onresult = null;
      try { old.stop(); } catch {}
      recognitionRef.current = null;
    }

    // Typewriter: show placeholder until voice starts (onstart will trigger the real typewriter)
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    const fullText = currentQuestion.questionText.trim();
    // Show first word as placeholder so the panel isn't completely blank
    setDisplayedText(fullText.split(' ').slice(0, 3).join(' ') + '…');
    setIsTyping(true);

    // Timer
    setTimeLeft(QUESTION_TIME);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    // Reset per-question mic guard
    micStartedRef.current = false;
    if (micFailsafeRef.current) { clearTimeout(micFailsafeRef.current); micFailsafeRef.current = null; }

    // Start speaking (or listening if autoRead is off)
    if (autoRead) {
      speakImplRef.current();
      // Failsafe: if TTS is silently dropped by Chrome (no onend/onerror fired),
      // start the mic anyway after estimated speech duration + 2s buffer.
      const wordCount = currentQuestion.questionText.trim().split(/\s+/).length;
      const estimatedMs = Math.max(3000, (wordCount / 2.5) * 1000); // ~2.5 words/sec at rate 0.85
      micFailsafeRef.current = setTimeout(() => {
        if (micEnabledRef.current && !isPausedRef.current && !micStartedRef.current) {
          micStartedRef.current = true;
          setIsSpeaking(false);
          listenImplRef.current();
        }
      }, estimatedMs + 2000);
    } else if (micEnabled) {
      micStartedRef.current = true;
      listenImplRef.current();
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);

  // Timer expiry → auto submit (also submit even with no answer to move forward)
  useEffect(() => {
    if (timeLeft === 0 && !isSubmittingRef.current && !evaluationRef.current) {
      void submitAnswerRef.current();
    }
  }, [timeLeft]);

  // Evaluating tip rotation
  useEffect(() => {
    if (isSubmitting) {
      setEvalTipIndex(0);
      evalTipIntervalRef.current = setInterval(() => {
        setEvalTipIndex(i => (i + 1) % EVAL_TIPS.length);
      }, 1600);
    } else {
      if (evalTipIntervalRef.current) clearInterval(evalTipIntervalRef.current);
    }
    return () => { if (evalTipIntervalRef.current) clearInterval(evalTipIntervalRef.current); };
  }, [isSubmitting]);

  // Camera capture
  useEffect(() => {
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    captureIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || !cameraOn) return;
      const canvas = canvasRef.current;
      canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        setSnapshots(prev => [...prev.slice(-4), canvas.toDataURL('image/jpeg', 0.6)]);
      }
    }, 7000);
    return () => { if (captureIntervalRef.current) clearInterval(captureIntervalRef.current); };
  }, [cameraOn]);

  // Camera stream
  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => { setErrorMsg('Camera unavailable.'); setCameraOn(false); });
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [cameraOn]);

  // Mic permission check on mount
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch(() => setShowMicModal(true));
  }, []);

  // ─── Mic toggle handler ───────────────────────────────────────────────────
  const toggleMic = () => {
    if (micEnabled) {
      // Turn OFF: stop recognition
      setMicEnabled(false);
      if (recognitionRef.current) {
        const old = recognitionRef.current;
        old.onend = null;
        old.onerror = null;
        old.onresult = null;
        try { old.stop(); } catch {}
        recognitionRef.current = null;
      }
      setIsRecording(false);
    } else {
      // Turn ON: start recognition immediately
      setMicEnabled(true);
      micEnabledRef.current = true;
      // Small delay to let state propagate before starting recognition
      setTimeout(() => listenImplRef.current(), 100);
    }
  };

  // ─── Submit Answer ────────────────────────────────────────────────────────
  const submitAnswer = async (overrideText?: string) => {
    const answerText = (overrideText ?? answer).trim();
    if (!currentQuestion) return;
    setAutoSubmitTriggered(false);

    // Stop recording
    if (recognitionRef.current) {
      const old = recognitionRef.current;
      old.onend = null;
      old.onerror = null;
      old.onresult = null;
      try { old.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);

    // Immediately move to next question UI (evaluate in background)
    isSubmittingRef.current = true;
    setErrorMsg('');

    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const updatedHistory = [
      ...answeredHistoryRef.current,
      { question: currentQuestion.questionText, answer: answerText },
    ];
    answeredHistoryRef.current = updatedHistory;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const snapshotsCopy = [...snapshots];
    setSnapshots([]);
    const questionForEval = currentQuestion;
    isVoiceAnswerRef.current = false;

    // Show a brief loading state while we wait for the next question from the backend,
    // then instantly switch without showing an evaluation screen.
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: questionForEval.id,
          userAnswer: answerText || '(no answer)',
          isVoice: false,
          timeTakenSeconds: timeTaken,
          history: updatedHistory,
          snapshots: snapshotsCopy,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(e.message ?? 'Failed to save answer');
      }

      const data = await res.json() as {
        evaluation: Evaluation;
        nextQuestion: Question | null;
        isFollowUp?: boolean;
      };

      evaluationRef.current = data.evaluation;
      setIsFollowUp(data.isFollowUp ?? false);

      if (data.nextQuestion) {
        // Instantly move to next question — no evaluation screen shown
        setCurrentQuestion(data.nextQuestion);
        setQuestionNumber(n => n + 1);
        setAnswer('');
        accumulatedTranscriptRef.current = '';
        evaluationRef.current = null;
      } else {
        await handleEndInterview();
      }
    } catch (err) {
      setErrorMsg('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };
  submitAnswerRef.current = submitAnswer;

  // ─── Pause / Resume ───────────────────────────────────────────────────────
  const handlePause = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    if (recognitionRef.current) {
      const old = recognitionRef.current;
      old.onend = null;
      try { old.stop(); } catch {}
    }
    setIsRecording(false);
  };

  const handleResume = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    if (autoRead) speakImplRef.current();
    else if (micEnabled) listenImplRef.current();
  };

  // ─── End Interview ────────────────────────────────────────────────────────
  const handleEndInterview = async () => {
    setIsEnding(true);
    window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    try {
      if (interviewId) {
        await apiFetch(`/api/interview/${interviewId}/complete`, { method: 'POST' });
        localStorage.removeItem(`interview_state_${interviewId}`);
        localStorage.removeItem('active_interview_id');
        navigate(`/results/${interviewId}`);
      } else {
        navigate('/dashboard');
      }
    } catch {
      navigate('/dashboard');
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const roundLabel: Record<string, string> = { HR: 'HR Round', MR: 'Managerial Round', TR: 'Technical Round' };
  const diffLabel: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const diffColor: Record<string, string> = {
    easy: 'text-green-400 border-green-500/40 bg-green-500/10',
    medium: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
    hard: 'text-red-400 border-red-500/40 bg-red-500/10',
  };
  const timerPercent = timeLeft / QUESTION_TIME;
  const timerStroke = 2 * Math.PI * 15;
  const displayName = (dbUser?.name || user?.displayName)?.split(' ')[0] ?? 'You';

  // ─── Guard ───────────────────────────────────────────────────────────────
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center space-y-4">
          <AlertCircle size={40} className="mx-auto text-[#555]" />
          <p className="text-lg font-medium text-white">No interview session found.</p>
          <button onClick={() => navigate('/dashboard')} className="bg-white text-black px-6 py-3 font-medium">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex bg-[#0a0a0a] text-white overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <canvas ref={canvasRef} className="hidden" />

      {/* ══ Pause Overlay ══ */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
              className="border border-[#2a2a2a] bg-[#111] p-10 flex flex-col items-center gap-5 max-w-sm w-full mx-6"
            >
              <div className="w-16 h-16 border border-[#333] flex items-center justify-center rounded-full">
                <Pause size={28} className="text-[#666]" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white">Interview Paused</h3>
                <p className="text-[#666] text-sm mt-2">Mic and timer are paused.</p>
              </div>
              <button onClick={handleResume} className="flex items-center gap-2 bg-white hover:bg-[#e5e5e5] text-black font-semibold px-8 py-3 w-full justify-center">
                <Play size={18} /> Resume
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Evaluating Overlay — brief spinner only, not full screen block ══ */}
      {/* Evaluation happens in background; overlay removed to avoid blocking next question */}

      {/* ══ Ending Interview Overlay ══ */}
      <AnimatePresence>
        {isEnding && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-8 text-center px-8">
              <div className="relative w-20 h-20">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white/10"
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <LogOut size={24} className="text-white" />
                </div>
              </div>
              <div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-semibold text-white mb-2"
                >
                  Wrapping up your interview…
                </motion.p>
                <p className="text-[#555] text-sm">Generating your performance report</p>
              </div>
              <div className="w-64 h-0.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <motion.div className="h-full bg-white rounded-full"
                  animate={{ width: ['0%', '100%'] }} transition={{ duration: 3, ease: 'easeInOut' }}
                />
              </div>
              <div className="flex items-center gap-6 text-[#333] text-xs">
                <span>✓ Saving responses</span>
                <span>✓ Scoring answers</span>
                <span>⟳ Building report</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Mic Permission Modal ══ */}
      <AnimatePresence>
        {showMicModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111] border border-[#2a2a2a] w-full max-w-md p-8"
            >
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 border border-red-500/40 bg-red-500/10 rounded-full flex items-center justify-center">
                  <MicOff size={24} className="text-red-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white text-center mb-2">Microphone Access Required</h3>
              <p className="text-sm text-[#666] text-center mb-6">InterviewIQ needs your microphone to transcribe answers in real-time.</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    try {
                      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                      s.getTracks().forEach(t => t.stop());
                      setShowMicModal(false);
                      setMicEnabled(true);
                      setTimeout(() => listenImplRef.current(), 100);
                    } catch {}
                  }}
                  className="w-full bg-white hover:bg-[#e5e5e5] text-black font-medium py-3 flex items-center justify-center gap-2"
                >
                  <Mic size={18} /> Try Again
                </button>
                <button onClick={() => setShowMicModal(false)} className="w-full text-[#555] hover:text-white py-3 text-sm">
                  Continue without microphone
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Voice Settings Drawer ══ */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50"
            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              className="bg-[#111] border border-[#2a2a2a] w-full max-w-lg p-6 mb-4 mx-4 rounded-t-lg"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-semibold text-white flex items-center gap-2"><Volume2 size={18} />Voice Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-[#555] hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Auto-read Questions</p>
                    <p className="text-xs text-[#555] mt-0.5">AI speaks the question automatically</p>
                  </div>
                  <button onClick={() => setAutoRead(!autoRead)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${autoRead ? 'bg-white' : 'bg-[#333]'}`}>
                    <motion.div animate={{ x: autoRead ? 22 : 3 }}
                      className={`absolute top-0.5 w-4 h-4 rounded-full ${autoRead ? 'bg-black' : 'bg-[#666]'}`} />
                  </button>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-white">Speaking Speed</p>
                    <span className="text-xs font-mono text-[#555]">{voiceRate.toFixed(2)}x</span>
                  </div>
                  <input type="range" min="0.5" max="1.5" step="0.05" value={voiceRate}
                    onChange={e => setVoiceRate(parseFloat(e.target.value))}
                    className="w-full accent-white h-1 cursor-pointer bg-[#333]" />
                  <div className="flex justify-between text-[10px] text-[#444] mt-1"><span>Slow</span><span>Fast</span></div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-white">Voice Pitch</p>
                    <span className="text-xs font-mono text-[#555]">{voicePitch.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.5" max="1.5" step="0.05" value={voicePitch}
                    onChange={e => setVoicePitch(parseFloat(e.target.value))}
                    className="w-full accent-white h-1 cursor-pointer bg-[#333]" />
                  <div className="flex justify-between text-[10px] text-[#444] mt-1"><span>Deep</span><span>High</span></div>
                </div>
              </div>
              <button
                onClick={() => { lastSpokenIdRef.current = null; speakImplRef.current(); setShowSettings(false); }}
                className="w-full mt-6 bg-white hover:bg-[#e5e5e5] text-black font-medium py-3 flex items-center justify-center gap-2 text-sm"
              >
                <Volume2 size={16} /> Test Voice & Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MAIN 3-PANEL LAYOUT
      ══════════════════════════════════════════════════════════════ */}

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-[220px] flex-shrink-0 border-r border-[#1a1a1a] bg-[#0d0d0d] flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b border-[#1a1a1a]">
          <p className="text-xs font-bold text-white tracking-widest uppercase">InterviewIQ</p>
        </div>

        <div className="px-4 py-4 border-b border-[#1a1a1a]">
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Interview Info</p>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-[#444] uppercase mb-1">Round</p>
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold border border-[#2a2a2a] bg-[#1a1a1a] text-white rounded">
                {roundLabel[roundType] ?? roundType}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-[#444] uppercase mb-1">Difficulty</p>
              <span className={`inline-flex px-2 py-1 text-[11px] font-semibold border rounded ${diffColor[difficulty] ?? 'text-white border-[#333] bg-[#1a1a1a]'}`}>
                {diffLabel[difficulty] ?? difficulty}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-[#444] uppercase mb-1">Progress</p>
              <p className="text-white text-sm font-semibold">Q {questionNumber}<span className="text-[#444]">/{totalQuestions}</span></p>
            </div>
            {isFollowUp && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-amber-500/30 bg-amber-500/10 text-amber-400 rounded">
                <Lightbulb size={10} /> Follow-up
              </span>
            )}
            <div>
              <p className="text-[10px] text-[#444] uppercase mb-1">Type</p>
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-[#2a2a2a] bg-[#1a1a1a] text-[#aaa] rounded">
                {currentQuestion.category === 'TECHNICAL' && <Code size={10} />}
                {currentQuestion.category === 'BEHAVIORAL' && <User size={10} />}
                {currentQuestion.category}
              </span>
            </div>
          </div>
        </div>

        {/* Circular Timer */}
        <div className="px-4 py-4 border-b border-[#1a1a1a] flex flex-col items-center gap-2">
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest self-start">Timer</p>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#1e1e1e" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="15" fill="none"
                stroke={timeLeft <= 10 ? '#ef4444' : '#ffffff'}
                strokeWidth="2.5"
                strokeDasharray={`${timerStroke}`}
                strokeDashoffset={timerStroke * (1 - timerPercent)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
              {timeLeft}
            </span>
          </div>
        </div>

        {/* Answer Tips Panel */}
        <div className="px-4 py-4 flex-1 overflow-y-auto">
          <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest mb-3">Answer Tips</p>
          <div className="space-y-3">
            {currentQuestion.category === 'TECHNICAL' ? (
              <>
                <div className="flex gap-2">
                  <span className="text-[#22c55e] text-[11px] mt-0.5 flex-shrink-0">▸</span>
                  <p className="text-[12px] text-[#666] leading-relaxed">Structure answer: Concept → Why it matters → Real-world use</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#22c55e] text-[11px] mt-0.5 flex-shrink-0">▸</span>
                  <p className="text-[12px] text-[#666] leading-relaxed">Mention trade-offs and alternatives where applicable</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#22c55e] text-[11px] mt-0.5 flex-shrink-0">▸</span>
                  <p className="text-[12px] text-[#666] leading-relaxed">Give a concrete example or scenario</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-blue-400 text-[11px] mt-0.5 flex-shrink-0">★</span>
                  <p className="text-[12px] text-[#555] leading-relaxed italic">Aim for 60–90 seconds depth</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <span className="text-[#f59e0b] text-[11px] mt-0.5 flex-shrink-0">▸</span>
                  <p className="text-[12px] text-[#666] leading-relaxed">Use STAR: Situation, Task, Action, Result</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#f59e0b] text-[11px] mt-0.5 flex-shrink-0">▸</span>
                  <p className="text-[12px] text-[#666] leading-relaxed">Be specific — avoid vague generalities</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#f59e0b] text-[11px] mt-0.5 flex-shrink-0">▸</span>
                  <p className="text-[12px] text-[#666] leading-relaxed">Quantify impact where possible (%, time saved)</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-blue-400 text-[11px] mt-0.5 flex-shrink-0">★</span>
                  <p className="text-[12px] text-[#555] leading-relaxed italic">Keep it concise — 90s to 2 min max</p>
                </div>
              </>
            )}
          </div>
          {/* Expected concepts hint */}
          {currentQuestion.expectedConcepts?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#1a1a1a]">
              <p className="text-[10px] font-semibold text-[#333] uppercase tracking-widest mb-2">Key Concepts</p>
              <div className="flex flex-wrap gap-1.5">
                {currentQuestion.expectedConcepts.slice(0, 5).map(c => (
                  <span key={c} className="text-[10px] px-2 py-0.5 border border-[#222] bg-[#111] text-[#555] rounded">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-[#1a1a1a]">
          <button
            onClick={handleEndInterview}
            disabled={isEnding || isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-400 text-xs font-medium transition-all disabled:opacity-40"
          >
            {isEnding ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
            {isEnding ? 'Ending…' : 'End Interview'}
          </button>
        </div>
      </div>

      {/* ── CENTER ── */}
      <div className="flex-1 flex flex-col bg-[#0a0a0a]">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#22c55e]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              LIVE
            </span>
            <span className="text-xs text-[#444]">{jobRole}</span>
          </div>
          <div className="flex items-center gap-2">
            {isSpeaking && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-full">
                <Volume2 size={11} /> AI is speaking
              </motion.span>
            )}
            {isRecording && !isSpeaking && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-xs font-medium text-[#22c55e] bg-green-500/10 border border-green-500/30 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Listening
              </motion.span>
            )}
            {!micEnabled && !isSpeaking && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[#555] bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-1 rounded-full">
                <MicOff size={11} /> Mic off
              </span>
            )}
            {errorMsg && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} /> {errorMsg}
              </span>
            )}
          </div>
        </div>

        {/* Video */}
        <div className="flex-1 relative bg-[#0f0f0f] overflow-hidden">
          {cameraOn ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 text-xs font-medium text-white rounded">
                {displayName}
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#333]">
              <CameraOff size={48} />
              <p className="text-sm">Camera is off</p>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-5 py-3 flex items-center justify-between gap-4">
          {/* AI bars */}
          <div className="flex items-center gap-2 min-w-[80px]">
            <span className="text-[10px] text-[#444] font-medium">AI</span>
            <AudioBars active={isSpeaking} color="#3b82f6" bars={6} />
          </div>

          {/* Center buttons */}
          <div className="flex items-center gap-2">
            {/* Camera toggle */}
            <button onClick={() => setCameraOn(!cameraOn)}
              className={`p-2.5 border transition-all ${cameraOn ? 'border-[#2a2a2a] text-white hover:border-[#444]' : 'border-red-500/40 text-red-400 bg-red-500/10'}`}>
              {cameraOn ? <Camera size={16} /> : <CameraOff size={16} />}
            </button>

            {/* Mic toggle — always visible */}
            <button
              onClick={toggleMic}
              title={micEnabled ? 'Turn off mic' : 'Turn on mic'}
              className={`p-2.5 border transition-all ${micEnabled
                ? isRecording
                  ? 'border-green-500/50 text-green-400 bg-green-500/10'
                  : 'border-[#2a2a2a] text-white hover:border-[#444]'
                : 'border-red-500/40 text-red-400 bg-red-500/10'
              }`}
            >
              {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            </button>

            {/* Pause */}
            <button onClick={isPaused ? handleResume : handlePause}
              className="p-2.5 border border-[#2a2a2a] text-white hover:border-[#444] transition-all">
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>

            {/* Evaluate */}
            <button
              onClick={() => void submitAnswer()}
              disabled={!answer.trim() || isSubmitting}
              className="flex items-center gap-2 bg-white hover:bg-[#e5e5e5] disabled:bg-[#1a1a1a] disabled:text-[#333] text-black font-semibold px-5 py-2.5 text-sm disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting
                ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                : <><CheckCircle2 size={15} /> Evaluate</>
              }
            </button>

            {/* Voice settings */}
            <button onClick={() => setShowSettings(true)}
              className="p-2.5 border border-[#2a2a2a] text-[#555] hover:text-white hover:border-[#444] transition-all">
              <Settings size={16} />
            </button>
          </div>

          {/* Your bars */}
          <div className="flex items-center gap-2 min-w-[80px] justify-end">
            <AudioBars active={isRecording} color="#22c55e" bars={6} />
            <span className="text-[10px] text-[#444] font-medium">YOU</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-[300px] flex-shrink-0 border-l border-[#1a1a1a] bg-[#0d0d0d] flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {micEnabled ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <p className="text-xs font-semibold text-white uppercase tracking-widest">Live Transcript</p>
              </>
            ) : (
              <>
                <Edit3 size={12} className="text-[#555]" />
                <p className="text-xs font-semibold text-white uppercase tracking-widest">Type Answer</p>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* AI question bubble */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-[#444] font-semibold uppercase">AI Interviewer</p>
            <div className="bg-[#111] border border-[#1e1e1e] p-3 text-[13px] text-[#ccc] leading-relaxed">
              {displayedText}
              {isTyping && <span className="inline-block w-0.5 h-4 bg-white ml-0.5 align-middle animate-pulse" />}
            </div>
          </div>

          {/* YOUR section — transcript OR textarea depending on mic */}
          <div className="flex flex-col gap-1 flex-1">
            <p className="text-[10px] text-[#444] font-semibold uppercase">You</p>

            {micEnabled ? (
              /* Live transcript bubble */
              <div className="bg-[#161616] border border-[#222] p-3 text-[13px] text-white leading-relaxed min-h-[80px]">
                {answer ? (
                  <>
                    {answer}
                    {isRecording && <span className="inline-block w-0.5 h-4 bg-green-400 ml-0.5 align-middle animate-pulse" />}
                  </>
                ) : isRecording ? (
                  <span className="text-[#444] italic">Listening…
                    <span className="inline-block w-0.5 h-4 bg-green-400 ml-0.5 align-middle animate-pulse" />
                  </span>
                ) : (
                  <span className="text-[#444] italic">Waiting for your response…</span>
                )}
              </div>
            ) : (
              /* Typing textarea when mic is off */
              <textarea
                value={answer}
                onChange={e => {
                  setAnswer(e.target.value);
                  isVoiceAnswerRef.current = false;
                }}
                placeholder="Type your answer here…"
                className="flex-1 bg-[#161616] border border-[#222] focus:border-[#444] outline-none p-3 text-[13px] text-white leading-relaxed resize-none min-h-[160px] placeholder-[#333] transition-colors"
              />
            )}

            {answer && (
              <p className="text-[10px] text-[#444] text-right">{answer.length} chars</p>
            )}
          </div>

          {micError && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">{micError}</div>
          )}
          {autoSubmitTriggered && (
            <div className="flex items-center gap-2 text-xs text-[#22c55e] bg-green-500/10 border border-green-500/20 px-3 py-2">
              <Send size={12} /> Auto-submitting…
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-[#1a1a1a]">
          {micEnabled ? (
            <p className="text-[10px] text-[#333] leading-relaxed">
              Say <span className="text-[#555]">"that's all"</span>, <span className="text-[#555]">"thank you"</span> or <span className="text-[#555]">"done"</span> to auto-submit.
            </p>
          ) : (
            <p className="text-[10px] text-[#333] leading-relaxed">
              Type your answer above, then click <span className="text-[#555]">Evaluate</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
