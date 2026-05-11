import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Camera, CameraOff, Volume2, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function InterviewRoom() {
  const [cameraOn, setCameraOn] = useState(true);
  const [answer, setAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const currentQuestion = "Can you describe a time when you had to optimize the performance of a React application? What specific techniques did you use?";

  // Camera Setup
  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setErrorMsg('');
        })
        .catch((err) => {
          console.error("Camera error:", err);
          setErrorMsg("Could not access camera. Check permissions.");
          setCameraOn(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraOn]);

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      setErrorMsg('');
      audioChunksRef.current = [];
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          audioStream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err: any) {
        console.error("Mic error:", err);
        setErrorMsg("Microphone access denied. Please allow microphone permissions.");
      }
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('http://localhost:3000/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed on server');
      }

      const data = await response.json();
      setAnswer(prev => prev ? prev + ' ' + data.transcript : data.transcript);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to transcribe audio. Ensure backend is running and Gemini API key is valid.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const speakQuestion = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQuestion);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row gap-6 p-6 bg-[#0a0a0f]">
      {/* Left Panel - Camera & Controls */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm shadow-lg backdrop-blur-sm">
            <AlertCircle size={16} />
            <p>{errorMsg}</p>
          </div>
        )}

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
              <span className="absolute bottom-4 left-4 text-xs font-medium bg-black/50 px-2 py-1 rounded text-white backdrop-blur-md">You</span>
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

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex-1">
          <h3 className="font-heading font-semibold text-lg mb-4 text-gray-200">Interview Status</h3>
          <div className="space-y-4 text-sm text-gray-400">
            <div className="flex justify-between items-center">
              <span>Question</span>
              <span className="font-medium text-purple-400">1 of 5</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Time Elapsed</span>
              <span className="font-mono">05:23</span>
            </div>
            <div className="w-full bg-gray-800 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-purple-500 w-1/5 h-full rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Q&A */}
      <div className="w-full md:w-2/3 flex flex-col gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-lg relative group"
        >
          <div className="inline-block bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-xs font-medium mb-4">
            Technical Round
          </div>
          <button 
            onClick={speakQuestion}
            className="absolute top-8 right-8 text-gray-500 hover:text-purple-400 transition-colors bg-gray-800/50 p-2 rounded-full"
            title="Read Question Aloud"
          >
            <Volume2 size={20} />
          </button>
          <h2 className="text-2xl font-medium leading-relaxed text-gray-100 pr-12">
            {currentQuestion}
          </h2>
        </motion.div>

        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col relative shadow-lg">
          <div className="flex justify-between items-center mb-2">
            {isRecording && (
              <div className="flex items-center gap-2 text-red-400 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-sm font-medium">Recording Audio...</span>
              </div>
            )}
            
            {isTranscribing && (
              <div className="flex items-center gap-2 text-purple-400 ml-auto">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm font-medium">Transcribing via AI...</span>
              </div>
            )}
          </div>
          
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={isTranscribing}
            placeholder={isTranscribing ? "Transcribing your audio..." : "Your voice answer will appear here, or you can type it..."}
            className="w-full flex-1 bg-transparent resize-none outline-none text-gray-200 placeholder-gray-600 text-lg leading-relaxed mt-2 disabled:opacity-50"
          ></textarea>
          
          <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center border-t border-gray-800 pt-4 mt-4 bg-gray-900">
            <button 
              onClick={toggleRecording}
              disabled={isTranscribing}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                isRecording 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' 
                  : 'bg-purple-600 text-white hover:bg-purple-500'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff size={20} />
                  <span>Stop & Transcribe</span>
                </>
              ) : (
                <>
                  <Mic size={20} />
                  <span>Start Voice Answer</span>
                </>
              )}
            </button>
            <button 
              disabled={isTranscribing}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors font-medium border border-gray-700 disabled:opacity-50"
            >
              <span>Submit</span>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
