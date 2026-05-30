import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2045C17.64 8.5664 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 12.9945 12.9232 12.0418 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z" fill="#4285F4" />
            <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0418 13.5613C11.2345 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853" />
            <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5932 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9582H0.957275C0.347727 6.1727 0 7.5477 0 9C0 10.4523 0.347727 11.8273 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05" />
            <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9255L15.0218 2.3441C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.9582L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335" />
        </svg>
    );
}



export default function SignUpPage() {
    const { signInWithGoogle, signUpEmail } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleOAuth = async (provider: 'google') => {
        setLoading(true);
        setError('');
        try {
            if (provider === 'google') await signInWithGoogle();
            // ProtectedRoute will redirect to /profile-setup if profile incomplete,
            // or /dashboard if already complete
            navigate('/dashboard');
        } catch (e: any) {
            setError(e.message?.replace('Firebase: ', '') ?? 'Sign-up failed');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
        setLoading(true);
        setError('');
        try {
            await signUpEmail(email, password, name);
            // onAuthStateChanged fires → fetchDbUser → ProtectedRoute sees
            // profileCompleted=false → auto-redirects to /profile-setup
            navigate('/dashboard');
        } catch (e: any) {
            setError(e.message?.replace('Firebase: ', '') ?? 'Sign-up failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-white">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm"
            >
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-black">Create account</h1>
                    <p className="text-[#666666] text-sm mt-1">Start your AI interview journey</p>
                </div>

                {error && (
                    <div className="mb-4 bg-[#FEF2F2] border border-[#FECACA] text-[#D00000] text-sm px-4 py-3">
                        {error}
                    </div>
                )}

                {/* Social */}
                <div className="space-y-3 mb-6">
                    <button
                        onClick={() => handleOAuth('google')}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#FAFAFA] border border-[#E5E5E5] text-black font-medium py-3 transition-all disabled:opacity-50"
                    >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                </div>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E5E5]" /></div>
                    <div className="relative flex justify-center text-xs text-[#999999] bg-white px-3 mx-auto w-fit">or with email</div>
                </div>

                <form onSubmit={handleEmailSignUp} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[#666666] mb-1.5">Full Name</label>
                        <div className="relative">
                            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#CCCCCC]" />
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required
                                className="w-full bg-white border border-[#E5E5E5] pl-10 pr-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[#666666] mb-1.5">Email</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#CCCCCC]" />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                                className="w-full bg-white border border-[#E5E5E5] pl-10 pr-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[#666666] mb-1.5">Password</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#CCCCCC]" />
                            <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required
                                className="w-full bg-white border border-[#E5E5E5] pl-10 pr-10 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm" />
                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#CCCCCC] hover:text-[#666666]">
                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !email || !password || !name}
                        className="w-full bg-black hover:bg-[#222222] disabled:bg-[#E5E5E5] disabled:text-[#999999] text-white font-medium py-3 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                        Create Account
                    </button>
                </form>

                <p className="text-center text-sm text-[#666666] mt-8">
                    Already have an account?{' '}
                    <Link to="/sign-in" className="text-black font-medium underline underline-offset-2 hover:opacity-70">Sign in</Link>
                </p>
            </motion.div>
        </div>
    );
}
