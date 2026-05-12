import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrainCircuit, Upload, PlayCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10"
      >
        <div className="flex items-center justify-center mb-6 text-purple-400">
          <BrainCircuit size={64} />
        </div>
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-heading">
          AI Interviewer Pro
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Experience an intelligent mock interview that adapts to your skills, evaluates your answers, and helps you land your dream job.
        </p>
        
        <div className="flex gap-6 justify-center">
          <Link
            to="/resume"
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-medium transition-all hover:scale-105 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
          >
            <Upload size={20} />
            Upload Resume
          </Link>
          <Link
            to="/interview"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-medium transition-all hover:scale-105 border border-gray-700"
          >
            <PlayCircle size={20} />
            Quick Practice
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
