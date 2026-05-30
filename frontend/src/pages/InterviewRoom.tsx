import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Send, Camera, CameraOff,
  Volume2, AlertCircle, Loader2, LogOut,
  Code, User, X, Lightbulb, Pause, Play,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../lib/api';


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
  idealAnswer?: string;
  missingConcepts: string[];
  behavioralFeedback?: {
    eyeContact: string;
    posture: string;
    confidence: string;
    overall: string;
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function InterviewRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const interviewId =
    state?.interviewId ?? (localStorage.getItem('active_interview_id') ? parseInt(localStorage.getItem('active_interview_id')!) : null);

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(state?.question ?? null);
  const totalQuestions = state?.totalQuestions ?? 10;
  const [questionNumber, setQuestionNumber] = useState(1);
  const [answer, setAnswer] = useState('');
  const [cameraOn, setCameraOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [_, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  const [showMicModal, setShowMicModal] = useState(false);

  // ─── Timer state ───
  const QUESTION_TIME = 120; // seconds
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Pause state ───
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  // ─── Follow-up badge ───
  const [isFollowUp, setIsFollowUp] = useState(false);

  // ─── Typewriter effect ───
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Auto-submit trigger phrases ───
  const TRIGGER_PHRASES = [
    "that's all", "thats all", "that is all",
    "i'm done", "im done", "i am done",
    "that's it", "thats it", "that is it",
    "submit answer", "submit",
    "i'm finished", "im finished", "i am finished",
    "that's my answer", "thats my answer",
    "that's everything", "thats everything",
    "end answer", "done",
  ];

  const submitAnswerRef = useRef<(override?: string) => Promise<void>>(() => Promise.resolve());
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);

  // ─── Voice Settings ───
  const [showSettings, setShowSettings] = useState(false);
  const [voiceRate, setVoiceRate] = useState(0.85);
  const [voicePitch, setVoicePitch] = useState(0.9);
  const [autoRead, setAutoRead] = useState(true);

  // ─── Persistence ───
  useEffect(() => {
    if (!interviewId) return;
    const saveState = () => {
      const stateToSave = {
        interviewId,
        currentQuestion,
        questionNumber,
        history: answeredHistoryRef.current,
        totalQuestions,
        voiceSettings: { voiceRate, voicePitch, autoRead },
      };
      localStorage.setItem(`interview_state_${interviewId}`, JSON.stringify(stateToSave));
      localStorage.setItem('active_interview_id', String(interviewId));
    };
    saveState();
  }, [interviewId, currentQuestion, questionNumber, voiceRate, voicePitch, autoRead, totalQuestions]);

  useEffect(() => {
    if (!state) {
      const activeId = localStorage.getItem('active_interview_id');
      if (activeId) {
        const saved = localStorage.getItem(`interview_state_${activeId}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setCurrentQuestion(parsed.currentQuestion);
            setQuestionNumber(parsed.questionNumber);
            answeredHistoryRef.current = parsed.history;
            setVoiceRate(parsed.voiceSettings.voiceRate);
            setVoicePitch(parsed.voiceSettings.voicePitch);
            setAutoRead(parsed.voiceSettings.autoRead);
          } catch (e) {
            console.error('Failed to restore interview state', e);
          }
        }
      }
    }
  }, [state]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isVoiceAnswerRef = useRef(false);
  const answeredHistoryRef = useRef<Array<{ question: string; answer: string }>>([]);

  const isSubmittingRef = useRef(false);
  const evaluationRef = useRef<Evaluation | null>(null);

  const answerRef = useRef('');
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const accumulatedTranscriptRef = useRef('');

  useEffect(() => {
    setAnswer('');
    setEvaluation(null);
    evaluationRef.current = null;
    isSubmittingRef.current = false;
    accumulatedTranscriptRef.current = '';
    setStartTime(Date.now());
    setIsFollowUp(false);
    setIsPaused(false);
    isPausedRef.current = false;
    window.speechSynthesis.cancel();

    if (typewriterRef.current) clearInterval(typewriterRef.current);
    const fullText = (currentQuestion?.questionText ?? '').trim();
    setDisplayedText(fullText.slice(0, 1));
    setIsTyping(true);
    let charIndex = 1;
    typewriterRef.current = setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(typewriterRef.current!);
        setIsTyping(false);
      }
    }, 22);

    setTimeLeft(QUESTION_TIME);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }
    }, 1000);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (timeLeft === 0 && answerRef.current.trim() && !isSubmitting && !evaluation) {
      void submitAnswer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => { answerRef.current = answer; }, [answer]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, []);

  // ─── Microphone Permission Check on Mount ───
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicPermission(result.state as 'granted' | 'denied' | 'prompt');

          if (result.state === 'denied') {
            setShowMicModal(true);
          } else if (result.state === 'prompt') {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach(t => t.stop());
              setMicPermission('granted');
            } catch {
              setMicPermission('denied');
              setShowMicModal(true);
            }
          }

          result.onchange = () => {
            setMicPermission(result.state as 'granted' | 'denied' | 'prompt');
            if (result.state === 'granted') {
              setShowMicModal(false);
              setErrorMsg('');
            }
          };
        } else {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            setMicPermission('granted');
          } catch {
            setMicPermission('denied');
            setShowMicModal(true);
          }
        }
      } catch {
        setMicPermission('prompt');
      }
    };

    checkMicPermission();
  }, []);

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicPermission('granted');
      setShowMicModal(false);
      setErrorMsg('');
      startContinuousListening();
    } catch {
      setMicPermission('denied');
    }
  };

  // Camera setup
  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch((err) => {
          console.warn('getUserMedia camera error:', err.name, err.message);
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
  const lastSpokenIdRef = useRef<number | null>(null);

  // ─── Voice Recording (Real-time & Continuous) ─────────────────────────────
  const [micError, setMicError] = useState<string>('');

  const startContinuousListening = useCallback(() => {
    if (evaluationRef.current || isSubmittingRef.current) return;
    setMicError('');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      isVoiceAnswerRef.current = true;
    };

    let lastSessionFinalText = '';

    recognition.onresult = (event: any) => {
      let sessionFinalText = '';
      let interimText = '';

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          sessionFinalText += (sessionFinalText ? ' ' : '') + event.results[i][0].transcript.trim();
        } else {
          interimText += (interimText ? ' ' : '') + event.results[i][0].transcript.trim();
        }
      }

      lastSessionFinalText = sessionFinalText;

      const fullText = [accumulatedTranscriptRef.current, sessionFinalText, interimText]
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .join(' ');

      const qText = currentQuestion?.questionText || '';
      const qNorm = qText.toLowerCase().replace(/\s+/g, ' ').trim();
      const tNorm = fullText.toLowerCase().replace(/\s+/g, ' ').trim();
      if (tNorm.length > 0 && tNorm.length <= qNorm.length && qNorm.includes(tNorm)) {
        return;
      }

      setAnswer(fullText);

      if (sessionFinalText) {
        const normalised = fullText.toLowerCase().replace(/[.,!?;:\s]+$/, '').trimEnd();

        const matchedTrigger = TRIGGER_PHRASES.find(phrase =>
          normalised.endsWith(phrase)
        );

        console.log('[AutoSubmit] normalised:', normalised, '| matched:', matchedTrigger ?? 'none');

        if (matchedTrigger && !evaluationRef.current && !isSubmittingRef.current) {
          const triggerIndex = normalised.lastIndexOf(matchedTrigger);
          const stripped = fullText
            .slice(0, triggerIndex)
            .replace(/[,.\s]+$/, '')
            .trim();

          try { recognition.onend = null; recognition.stop(); } catch { /* already stopped */ }
          setIsRecording(false);

          const finalAnswer = stripped.length > 0 ? stripped : accumulatedTranscriptRef.current.trim();
          if (finalAnswer.length > 0) {
            setAnswer(finalAnswer);
            setAutoSubmitTriggered(true);
            void submitAnswerRef.current(finalAnswer);
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);

      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          setMicPermission('denied');
          setShowMicModal(true);
          break;

        case 'no-speech':
          break;

        case 'aborted':
          break;

        case 'audio-capture':
          setMicError('No microphone detected. Please plug in a mic and refresh the page.');
          break;

        case 'network':
          setMicError('');
          setTimeout(() => {
            try { recognition.start(); } catch { /* already handled by onend */ }
          }, 1000);
          break;

        case 'service-not-allowed':
          setMicError('Speech recognition is not allowed. Make sure you are using HTTPS or localhost, and that the browser has mic permission.');
          break;

        case 'bad-grammar':
        case 'language-not-supported':
          setMicError('Speech language not supported. Try switching your browser language to English.');
          break;

        default:
          setMicError(`Microphone error (${event.error}). Try refreshing the page or clicking the mic button below.`);
      }

      if (lastSessionFinalText.trim()) {
        accumulatedTranscriptRef.current = [accumulatedTranscriptRef.current, lastSessionFinalText]
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .join(' ');
        lastSessionFinalText = '';
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (lastSessionFinalText.trim()) {
        accumulatedTranscriptRef.current = [accumulatedTranscriptRef.current, lastSessionFinalText]
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .join(' ');
        lastSessionFinalText = '';
      }

      setTimeout(() => setIsRecording(false), 100);
      
      if (!evaluationRef.current && !isSubmittingRef.current && !isPausedRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch (e: any) {
          setMicError(`Restart failed: ${e.message}`);
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }

    captureIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || !cameraOn) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setSnapshots(prev => [...prev.slice(-4), dataUrl]);
      }
    }, 7000);

    return () => {
      recognition.onend = null;
      recognition.stop();
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, [currentQuestion, cameraOn]);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ─── Speech Synthesis (humanized) ────────────────────────────────────────
  const speakQuestion = useCallback(() => {
    if (!currentQuestion || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const applyVoice = (u: SpeechSynthesisUtterance) => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang === 'en-IN' && v.name.toLowerCase().includes('google')) ??
        voices.find((v) => v.lang === 'en-IN') ??
        voices.find((v) => v.name.toLowerCase().includes('google') && v.lang.startsWith('en')) ??
        voices.find((v) => v.lang === 'en-US') ??
        voices.find((v) => v.lang.startsWith('en')) ??
        null;
      if (preferred) u.voice = preferred;
    };

    const questionU = new SpeechSynthesisUtterance(currentQuestion.questionText);
    utteranceRef.current = questionU;

    applyVoice(questionU);
    questionU.rate = voiceRate;
    questionU.pitch = voicePitch;
    questionU.volume = 1.0;

    questionU.onend = () => { setTimeout(() => startContinuousListening(), 400); };
    questionU.onerror = () => {
      console.warn('SpeechSynthesis error, starting mic anyway');
      setTimeout(() => startContinuousListening(), 200);
    };

    const startSpeaking = () => {
      if (lastSpokenIdRef.current === currentQuestion.id) return;
      lastSpokenIdRef.current = currentQuestion.id;

      applyVoice(questionU);
      setTimeout(() => {
        window.speechSynthesis.speak(questionU);
      }, 50);
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

  useEffect(() => {
    if (!currentQuestion) return;
    
    if (autoRead) {
      speakQuestion();
    } else {
      startContinuousListening();
    }
  }, [currentQuestion?.id, autoRead, speakQuestion, startContinuousListening]);

  // ─── Submit Answer ────────────────────────────────────────────────────────
  const submitAnswer = async (overrideText?: string) => {
    const answerText = overrideText ?? answer;
    if (!answerText.trim() || !currentQuestion) return;
    setAutoSubmitTriggered(false);

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    setErrorMsg('');
    const timeTakenSeconds = Math.round((Date.now() - startTime) / 1000);

    const updatedHistory = [
      ...answeredHistoryRef.current,
      { question: currentQuestion.questionText, answer: answerText.trim() }
    ];

    try {
      const res = await apiFetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          userAnswer: answerText.trim(),
          isVoice: isVoiceAnswerRef.current,
          timeTakenSeconds,
          history: updatedHistory,
          snapshots,
        }),
      });

      setSnapshots([]);

      if (!res.ok) {
        let serverMsg = 'Failed to save answer';
        try {
          const e = await res.json() as { message?: string };
          if (e.message) serverMsg = e.message;
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }

      const data = await res.json() as { evaluation: Evaluation; nextQuestion: Question | null; isFollowUp?: boolean };

      evaluationRef.current = data.evaluation;
      setIsFollowUp(data.isFollowUp ?? false);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      answeredHistoryRef.current = updatedHistory;

      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setQuestionNumber((n) => n + 1);
        setAnswer('');
        accumulatedTranscriptRef.current = '';
        setStartTime(Date.now());
      } else {
        await handleEndInterview();
      }

      isVoiceAnswerRef.current = false;
      recognitionRef.current?.stop();
    } catch (err: unknown) {
      setErrorMsg('Could not save answer: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };
  submitAnswerRef.current = submitAnswer;

  // ─── Pause / Resume ──────────────────────────────────────────────────────
  const handlePause = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch {}
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    if (autoRead) speakQuestion();
    else startContinuousListening();
  };

  // ─── End Interview ────────────────────────────────────────────────────────
  const handleEndInterview = async () => {
    setIsEnding(true);
    window.speechSynthesis.cancel();
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
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

  // ─── Microphone Permission Modal ──────────────────────────────────────────
  const micPermissionModal = (
    <AnimatePresence>
      {showMicModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-white border border-[#E5E5E5] w-full max-w-md p-8"
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 border-2 border-[#D00000] flex items-center justify-center">
                <MicOff size={28} className="text-[#D00000]" />
              </div>
            </div>

            <h3 className="text-lg font-semibold text-black text-center mb-2">
              Microphone Access Required
            </h3>
            <p className="text-sm text-[#666666] text-center mb-8">
              InterviewIQ needs your microphone to transcribe your answers in real-time.
            </p>

            <div className="border border-[#E5E5E5] p-5 mb-6 space-y-3">
              <p className="text-xs font-medium text-[#999999] uppercase tracking-widest mb-3">How to enable:</p>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 border border-[#E5E5E5] flex items-center justify-center text-xs font-semibold text-black">1</span>
                <p className="text-sm text-[#666666]">Click the <span className="font-medium text-black">🔒 lock icon</span> in your browser's address bar</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 border border-[#E5E5E5] flex items-center justify-center text-xs font-semibold text-black">2</span>
                <p className="text-sm text-[#666666]">Find <span className="font-medium text-black">Microphone</span> and set it to <span className="font-medium text-black">Allow</span></p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 border border-[#E5E5E5] flex items-center justify-center text-xs font-semibold text-black">3</span>
                <p className="text-sm text-[#666666]">Click <span className="font-medium text-black">"Try Again"</span> below or refresh the page</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={requestMicPermission}
                className="w-full bg-black hover:bg-[#222222] text-white font-medium py-3.5 transition-all flex items-center justify-center gap-2"
              >
                <Mic size={18} />
                Try Again
              </button>
              <button
                onClick={() => setShowMicModal(false)}
                className="w-full text-[#999999] hover:text-black font-medium py-3 transition-colors text-sm flex items-center justify-center gap-2"
              >
                Continue without microphone
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ─── Guard ────────────────────────────────────────────────────────────────
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-white">
        {micPermissionModal}
        <div className="text-center text-[#666666] space-y-4">
          <AlertCircle size={40} className="mx-auto text-[#999999]" />
          <p className="text-lg font-medium">No interview session found.</p>
          <p className="text-sm">Please go back and start an interview first.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 bg-black hover:bg-[#222222] text-white px-6 py-3 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const categoryStyle: Record<string, string> = {
    TECHNICAL:  'border-[#E5E5E5] text-black bg-[#FAFAFA]',
    BEHAVIORAL: 'border-[#E5E5E5] text-black bg-[#FAFAFA]',
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row gap-6 p-6 bg-white">

      {/* ── Pause Overlay ── */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-white/95"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              className="border border-[#E5E5E5] p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-6"
            >
              <div className="w-16 h-16 border-2 border-[#E5E5E5] flex items-center justify-center">
                <Pause size={28} className="text-[#999999]" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-black">Interview Paused</h3>
                <p className="text-[#666666] text-sm mt-2">Your mic and timer are paused. Resume when you're ready.</p>
              </div>
              <button
                onClick={handleResume}
                className="flex items-center gap-2 bg-black hover:bg-[#222222] text-white font-medium px-8 py-3.5 transition-all w-full justify-center"
              >
                <Play size={18} /> Resume Interview
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings Modal ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              className="bg-white border border-[#E5E5E5] w-full max-w-md p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-semibold text-black flex items-center gap-2">
                  <Volume2 size={20} />
                  Voice Settings
                </h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-[#999999] hover:text-black transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Auto Read Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black">Auto-read Questions</p>
                    <p className="text-xs text-[#999999]">AI will speak as soon as the question appears.</p>
                  </div>
                  <button 
                    onClick={() => setAutoRead(!autoRead)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${autoRead ? 'bg-black' : 'bg-[#E5E5E5]'}`}
                  >
                    <motion.div 
                      animate={{ x: autoRead ? 22 : 3 }}
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full border border-[#E5E5E5]"
                    />
                  </button>
                </div>

                {/* Voice Rate */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-medium text-black">Speaking Speed</p>
                    <span className="text-xs font-mono text-[#999999]">{voiceRate.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.05"
                    value={voiceRate}
                    onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                    className="w-full accent-black h-1 appearance-none cursor-pointer bg-[#E5E5E5]"
                  />
                  <div className="flex justify-between text-[10px] text-[#CCCCCC] mt-2 font-medium uppercase tracking-widest">
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>

                {/* Voice Pitch */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-medium text-black">Voice Pitch</p>
                    <span className="text-xs font-mono text-[#999999]">{voicePitch.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.05"
                    value={voicePitch}
                    onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                    className="w-full accent-black h-1 appearance-none cursor-pointer bg-[#E5E5E5]"
                  />
                  <div className="flex justify-between text-[10px] text-[#CCCCCC] mt-2 font-medium uppercase tracking-widest">
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
                className="w-full mt-10 bg-black hover:bg-[#222222] text-white font-medium py-3.5 transition-all flex items-center justify-center gap-2"
              >
                <Volume2 size={18} />
                Test Voice & Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left Panel ── */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#D00000] p-3 flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Camera */}
        <div className="relative aspect-video bg-[#FAFAFA] overflow-hidden border border-[#E5E5E5] flex items-center justify-center">
          {cameraOn ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
              />
              <span className="absolute bottom-3 left-3 text-xs font-medium bg-black/60 px-2 py-1 text-white">
                You
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center text-[#CCCCCC]">
              <CameraOff className="w-12 h-12 mb-2" />
              <span className="text-sm">Camera Disabled</span>
            </div>
          )}
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="bg-white/90 hover:bg-white border border-[#E5E5E5] text-black p-2.5 transition-colors z-10"
              title="Voice Settings"
            >
              <Volume2 size={16} />
            </button>
            <button
              onClick={() => setCameraOn(!cameraOn)}
              className="bg-white/90 hover:bg-white border border-[#E5E5E5] text-black p-2.5 transition-colors z-10"
            >
              {cameraOn ? <Camera size={16} /> : <CameraOff size={16} />}
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="border border-[#E5E5E5] p-6 flex-1">
          <h3 className="font-medium text-base mb-4 text-black">Interview Status</h3>
          <div className="space-y-4 text-sm text-[#666666]">

            {interviewId && (
              <div className="flex justify-between items-center">
                <span>Interview ID</span>
                <span className="font-mono text-[#999999]">#{interviewId}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>Answered</span>
              <span className="font-medium text-black">
                {answeredHistoryRef.current.length} question{answeredHistoryRef.current.length !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-2 pt-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-black" />
              </span>
              <span className="text-xs text-[#999999]">Interview in progress</span>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="border border-[#E5E5E5] p-8 relative"
          >
            {/* Category + Difficulty + Timer row */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium border ${categoryStyle[currentQuestion.category] ?? 'border-[#E5E5E5] text-black bg-[#FAFAFA]'}`}>
                {currentQuestion.category === 'TECHNICAL'  && <Code size={14} />}
                {currentQuestion.category === 'BEHAVIORAL' && <User size={14} />}
                <span className="text-xs font-medium tracking-wider">
                  {currentQuestion.category}
                </span>
              </div>
              <span className="text-xs text-[#999999]">
                Difficulty: {'★'.repeat(currentQuestion.difficulty)}{'☆'.repeat(5 - currentQuestion.difficulty)}
              </span>

              {/* Follow-up badge */}
              <AnimatePresence>
                {isFollowUp && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-[#E5E5E5] bg-[#FAFAFA] text-black"
                  >
                    <Lightbulb size={11} /> Follow-up
                  </motion.span>
                )}
              </AnimatePresence>

              <div className="ml-auto flex items-center gap-2">
                {/* Speaker button */}
                <button
                  onClick={speakQuestion}
                  className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] hover:border-black text-[#999999] hover:text-black transition-all"
                  title="Read Question Aloud"
                >
                  <Volume2 size={14} />
                </button>

                {/* Timer ring */}
                <div className="relative w-8 h-8">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E5E5" strokeWidth="2"/>
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke={timeLeft <= 10 ? '#D00000' : '#000000'}
                      strokeWidth="2"
                      strokeDasharray="94.2"
                      strokeDashoffset={94.2 - (94.2 * timeLeft) / QUESTION_TIME}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-semibold ${
                    timeLeft <= 10 ? 'text-[#D00000]' : 'text-black'
                  }`}>
                    {timeLeft}
                  </span>
                </div>

                {/* Pause button */}
                {!evaluation && (
                  <button
                    onClick={handlePause}
                    className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] hover:border-black text-[#999999] hover:text-black transition-all"
                    title="Pause interview"
                  >
                    <Pause size={13} />
                  </button>
                )}
              </div>
            </div>
            <h2 className="text-xl font-semibold text-black leading-relaxed mt-1">
              {displayedText}
              {isTyping && (
                <span className="inline-block w-0.5 h-5 bg-black ml-0.5 align-middle animate-pulse" />
              )}
            </h2>
          </motion.div>
        </AnimatePresence>

        {/* Answer Area */}
        {!isSubmitting ? (
          <div className="flex-1 flex flex-col gap-6">
            <div className="relative group">
              <textarea
                value={answer}
                readOnly
                placeholder="The interviewer is listening... your words will appear here as you speak."
                className="w-full h-[450px] min-h-[400px] bg-white border border-[#E5E5E5] p-5 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all resize-none text-base leading-relaxed"
              />
              <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
                <div className="flex items-center gap-3">
                  {isRecording && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAFAFA] border border-[#E5E5E5]">
                      <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-black uppercase tracking-wider">Listening</span>
                    </div>
                  )}

                  {autoSubmitTriggered && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAFAFA] border border-[#E5E5E5]">
                      <div className="w-2 h-2 bg-black rounded-full animate-ping" />
                      <span className="text-xs font-medium text-black uppercase tracking-wider">Auto-submitting…</span>
                    </div>
                  )}

                  {!isRecording && (
                    <button
                      onClick={startContinuousListening}
                      className="flex items-center gap-2 text-[#999999] hover:text-black transition-colors text-xs font-medium border border-[#E5E5E5] px-3 py-1.5 bg-white"
                    >
                      <Mic size={14} />
                      <span>Mic didn't start? Click to Listen</span>
                    </button>
                  )}
                </div>
                {micError && (
                  <div className="text-xs text-[#D00000] bg-[#FEF2F2] border border-[#FECACA] px-3 py-1.5 max-w-sm truncate" title={micError}>
                    {micError}
                  </div>
                )}
                <span className={`text-xs font-medium font-mono ${answer.length > 500 ? 'text-[#999999]' : 'text-[#CCCCCC]'}`}>
                  {answer.length} chars
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center gap-3 mt-2">
              {/* Left: End Interview */}
              <button
                onClick={handleEndInterview}
                disabled={isEnding || isSubmitting}
                className="flex items-center gap-2 px-5 py-3 border border-[#E5E5E5] hover:border-black text-[#666666] hover:text-black font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <LogOut size={16} />
                End Interview
              </button>

              {/* Center: Pause */}
              <button
                onClick={handlePause}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-3 border border-[#E5E5E5] hover:border-black text-[#666666] hover:text-black font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pause size={16} />
                Pause
              </button>

              <div className="flex items-center gap-3 ml-auto">
                {!isRecording && (
                  <button
                    onClick={startContinuousListening}
                    className="flex items-center gap-2 text-[#999999] hover:text-black transition-colors text-xs font-medium border border-[#E5E5E5] px-3 py-1.5"
                  >
                    <Mic size={14} />
                    <span>Mic didn't start? Click to Listen</span>
                  </button>
                )}

                <button
                  onClick={() => submitAnswer()}
                  disabled={!answer.trim() || isSubmitting}
                  className="flex items-center gap-2 bg-black hover:bg-[#222222] text-white px-10 py-3.5 transition-all font-medium disabled:bg-[#E5E5E5] disabled:text-[#999999] disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <><Loader2 size={18} className="animate-spin" /><span>Saving…</span></>
                  ) : (
                    <><span>Submit Answer</span><Send size={18} /></>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Submitting state */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 border border-[#E5E5E5] p-8 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 size={28} className="animate-spin text-black" />
              <p className="text-[#666666] text-base font-medium">Saving your answer…</p>
              <p className="text-[#999999] text-sm">Next question coming right up</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
