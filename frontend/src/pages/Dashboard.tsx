import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [jobRole, setJobRole] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleUpload = async () => {
    if (!file || !jobRole) return;
    
    setIsUploading(true);
    // Simulate upload and processing
    setTimeout(() => {
      setIsUploading(false);
      navigate('/interview');
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-3xl p-10 shadow-2xl z-10 relative">
        <h2 className="text-3xl font-heading font-bold mb-8 text-center bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Setup Your Interview
        </h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Target Job Role</label>
            <input 
              type="text" 
              placeholder="e.g. Senior Frontend Developer" 
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Upload Resume (PDF)</label>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center hover:bg-gray-800/50 transition-colors relative cursor-pointer group">
              <input 
                type="file" 
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="flex flex-col items-center gap-3 text-purple-400">
                  <FileText size={48} />
                  <span className="font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-500 group-hover:text-purple-400 transition-colors">
                  <UploadCloud size={48} />
                  <span className="font-medium">Drag & drop or click to browse</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || !jobRole || isUploading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isUploading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Processing Resume...
              </>
            ) : (
              'Start Mock Interview'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
