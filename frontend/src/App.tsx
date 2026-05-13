import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import InterviewRoom from './pages/InterviewRoom';
import Dashboard from './pages/Dashboard';
import ResumeUpload from './pages/ResumeUpload';
import Results from './pages/Results';
import Navbar from './components/Navbar';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
        <Navbar />
        {/* pt-16 clears the fixed navbar (64px tall) */}
        <div className="pt-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/resume" element={<ResumeUpload />} />
            <Route path="/interview/:id" element={<InterviewRoom />} />
            <Route path="/interview" element={<InterviewRoom />} />
            <Route path="/results/:id" element={<Results />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
