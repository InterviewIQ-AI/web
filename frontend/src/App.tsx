import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import InterviewRoom from './pages/InterviewRoom';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';
import History from './pages/History';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import ProfileSetup from './pages/ProfileSetup';
import ProfilePage from './pages/ProfilePage';
import Navbar from './components/Navbar';
import { Loader2 } from 'lucide-react';

// Routes where we hide the Navbar and top padding (full-screen pages)
const FULLSCREEN_ROUTES = ['/interview'];

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-black" size={32} />
    </div>
  );
}

/**
 * requireProfile = true  → needs auth AND completed profile (Dashboard, History, etc.)
 * requireProfile = false → needs auth only (ProfileSetup itself)
 */
function ProtectedRoute({
  children,
  requireProfile = true,
}: {
  children: React.ReactNode;
  requireProfile?: boolean;
}) {
  const { user, dbUser, loading, dbUserLoading } = useAuth();

  // 1. Wait for Firebase auth to resolve
  if (loading) return <FullPageSpinner />;

  // 2. Not signed in → sign-in page
  if (!user) return <Navigate to="/sign-in" replace />;

  // 3. Wait for DB profile to load before making profile decisions
  if (dbUserLoading) return <FullPageSpinner />;

  // 4. Profile setup gate — only for routes that require a completed profile
  if (requireProfile && dbUser && !dbUser.profileCompleted) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
}

function AppShell() {
  const location = useLocation();
  const isFullscreen = FULLSCREEN_ROUTES.some(r => location.pathname.startsWith(r));

  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {!isFullscreen && <Navbar />}
      <div className={!isFullscreen ? 'pt-16' : ''}>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────── */}
          <Route path="/" element={<Home />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />

          {/* ── Auth required, profile NOT required ────────────────── */}
          <Route
            path="/profile-setup"
            element={
              <ProtectedRoute requireProfile={false}>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />

          {/* ── Auth + completed profile required ──────────────────── */}
          <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/interview/:id" element={<ProtectedRoute><InterviewRoom /></ProtectedRoute>} />
          <Route path="/interview"    element={<ProtectedRoute><InterviewRoom /></ProtectedRoute>} />
          <Route path="/results/:id"  element={<ProtectedRoute><Results /></ProtectedRoute>} />
          <Route path="/history"      element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/profile"      element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
