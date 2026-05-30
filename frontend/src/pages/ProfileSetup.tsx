import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Phone, Briefcase, GraduationCap,
    Link2, Target, Star, ChevronRight, ChevronLeft, Check, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

// ─── Skill tag input ─────────────────────────────────────────────────────────
function SkillTagInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
    const [input, setInput] = useState('');

    const add = () => {
        const trimmed = input.trim();
        if (trimmed && !skills.includes(trimmed)) {
            onChange([...skills, trimmed]);
        }
        setInput('');
    };

    const remove = (skill: string) => onChange(skills.filter(s => s !== skill));

    return (
        <div>
            <div className="flex gap-2 mb-3">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                    placeholder="e.g. React, Node.js, Python…"
                    className="flex-1 bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm"
                />
                <button
                    type="button"
                    onClick={add}
                    className="bg-black hover:bg-[#222222] text-white px-4 transition-all text-sm font-medium"
                >
                    Add
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {skills.map(skill => (
                    <span
                        key={skill}
                        className="flex items-center gap-1.5 bg-[#F5F5F5] border border-[#E5E5E5] text-black text-xs font-medium px-3 py-1.5"
                    >
                        {skill}
                        <button
                            type="button"
                            onClick={() => remove(skill)}
                            className="text-[#999999] hover:text-[#D00000] transition-colors ml-0.5 text-xs leading-none"
                        >
                            ✕
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Step config ──────────────────────────────────────────────────────────────
const steps = [
    { id: 'basic', label: 'Basic Info', icon: User },
    { id: 'career', label: 'Career', icon: Briefcase },
    { id: 'skills', label: 'Skills & Goals', icon: Target },
];

export default function ProfileSetup() {
    const { user, dbUser, refreshDbUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Form state — matches every column in the users table
    const [form, setForm] = useState({
        name: user?.displayName ?? '',
        phone: '',
        currentRole: '',
        yearsOfExperience: '',
        targetRole: '',
        education: '',
        linkedinUrl: '',
        skills: [] as string[],
    });

    // Pre-fill any fields already stored in DB (e.g. name, skills)
    useEffect(() => {
        if (dbUser) {
            setForm(f => ({
                ...f,
                name: dbUser.name ?? f.name,
                phone: dbUser.phone ?? f.phone,
                currentRole: dbUser.currentRole ?? f.currentRole,
                yearsOfExperience: dbUser.yearsOfExperience?.toString() ?? f.yearsOfExperience,
                targetRole: dbUser.targetRole ?? f.targetRole,
                education: dbUser.education ?? f.education,
                linkedinUrl: dbUser.linkedinUrl ?? f.linkedinUrl,
                skills: (dbUser.skills as string[]) ?? f.skills,
            }));
        }
    }, [dbUser]);

    const set = (field: string, value: any) =>
        setForm(f => ({ ...f, [field]: value }));

    const isStepValid = () => {
        if (step === 0) return form.name.trim().length > 0;
        if (step === 1) return form.currentRole.trim().length > 0;
        return form.targetRole.trim().length > 0;
    };

    const handleSubmit = async () => {
        setSaving(true);
        setError('');
        try {
            const res = await apiFetch('/api/users/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
                }),
            });
            if (!res.ok) throw new Error('Failed to save profile');
            await refreshDbUser();
            navigate('/dashboard', { replace: true });
        } catch (e: any) {
            setError(e.message ?? 'Something went wrong');
        } finally {
            setSaving(false);
        }
    };

    const displayName = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there';

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-white">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-lg"
            >
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-black">Complete Your Profile</h1>
                    <p className="text-[#666666] text-sm mt-1">
                        Hey <span className="text-black font-medium">{displayName}</span> — this takes less than a minute
                    </p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-0 mb-8">
                    {steps.map((s, i) => (
                        <div key={s.id} className="flex items-center">
                            <div className={`flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wider border transition-all ${
                                i === step
                                    ? 'bg-black text-white border-black'
                                    : i < step
                                        ? 'bg-[#F5F5F5] text-black border-[#E5E5E5]'
                                        : 'bg-white text-[#CCCCCC] border-[#E5E5E5]'
                            }`}>
                                {i < step
                                    ? <Check size={12} />
                                    : <s.icon size={12} />
                                }
                                {s.label}
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`w-6 h-px ${i < step ? 'bg-black' : 'bg-[#E5E5E5]'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Card */}
                <div className="border border-[#E5E5E5] p-8">
                    {error && (
                        <div className="mb-5 bg-[#FEF2F2] border border-[#FECACA] text-[#D00000] text-sm px-4 py-3">
                            {error}
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {/* ── Step 0: Basic Info ── */}
                        {step === 0 && (
                            <motion.div
                                key="step0"
                                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                                className="space-y-5"
                            >
                                <h2 className="text-base font-semibold text-black mb-4 flex items-center gap-2">
                                    <User size={16} /> Basic Information
                                </h2>

                                <div>
                                    <label className="block text-xs font-medium text-[#666666] uppercase tracking-widest mb-2">
                                        Full Name <span className="text-[#D00000]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => set('name', e.target.value)}
                                        placeholder="John Doe"
                                        className="w-full bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[#666666] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Phone size={11} /> Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={e => set('phone', e.target.value)}
                                        placeholder="+91 98765 43210"
                                        className="w-full bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[#666666] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Link2 size={11} /> LinkedIn URL
                                    </label>
                                    <input
                                        type="url"
                                        value={form.linkedinUrl}
                                        onChange={e => set('linkedinUrl', e.target.value)}
                                        placeholder="https://linkedin.com/in/yourname"
                                        className="w-full bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm"
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* ── Step 1: Career ── */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                                className="space-y-5"
                            >
                                <h2 className="text-base font-semibold text-black mb-4 flex items-center gap-2">
                                    <Briefcase size={16} /> Career Background
                                </h2>

                                <div>
                                    <label className="block text-xs font-medium text-[#666666] uppercase tracking-widest mb-2">
                                        Current Role <span className="text-[#D00000]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.currentRole}
                                        onChange={e => set('currentRole', e.target.value)}
                                        placeholder="e.g. Full Stack Developer"
                                        className="w-full bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[#666666] uppercase tracking-widest mb-2">
                                        Years of Experience
                                    </label>
                                    <select
                                        value={form.yearsOfExperience}
                                        onChange={e => set('yearsOfExperience', e.target.value)}
                                        className="w-full bg-white border border-[#E5E5E5] px-4 py-3 text-black focus:outline-none focus:border-black transition-all text-sm"
                                    >
                                        <option value="">Select experience level</option>
                                        <option value="0">Fresher / Student</option>
                                        <option value="1">0–1 years</option>
                                        <option value="2">1–2 years</option>
                                        <option value="4">3–5 years</option>
                                        <option value="7">5–10 years</option>
                                        <option value="11">10+ years</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[#666666] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <GraduationCap size={11} /> Highest Education
                                    </label>
                                    <select
                                        value={form.education}
                                        onChange={e => set('education', e.target.value)}
                                        className="w-full bg-white border border-[#E5E5E5] px-4 py-3 text-black focus:outline-none focus:border-black transition-all text-sm"
                                    >
                                        <option value="">Select education</option>
                                        <option value="High School">High School</option>
                                        <option value="Diploma">Diploma</option>
                                        <option value="B.Tech / B.E.">B.Tech / B.E.</option>
                                        <option value="B.Sc / B.Com / B.A.">B.Sc / B.Com / B.A.</option>
                                        <option value="M.Tech / M.E.">M.Tech / M.E.</option>
                                        <option value="MBA">MBA</option>
                                        <option value="PhD">PhD</option>
                                        <option value="Self-taught / Bootcamp">Self-taught / Bootcamp</option>
                                    </select>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Step 2: Skills & Goals ── */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                                className="space-y-5"
                            >
                                <h2 className="text-base font-semibold text-black mb-4 flex items-center gap-2">
                                    <Target size={16} /> Skills & Interview Goals
                                </h2>

                                <div>
                                    <label className="block text-xs font-medium text-[#666666] uppercase tracking-widest mb-2">
                                        Target Role <span className="text-[#D00000]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.targetRole}
                                        onChange={e => set('targetRole', e.target.value)}
                                        placeholder="e.g. Senior Backend Engineer at a startup"
                                        className="w-full bg-white border border-[#E5E5E5] px-4 py-3 text-black placeholder-[#CCCCCC] focus:outline-none focus:border-black transition-all text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[#666666] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Star size={11} /> Your Skills
                                        <span className="text-[#CCCCCC] normal-case font-normal ml-1">(press Enter to add)</span>
                                    </label>
                                    <SkillTagInput
                                        skills={form.skills}
                                        onChange={s => set('skills', s)}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E5E5E5]">
                        {step > 0 ? (
                            <button
                                onClick={() => setStep(s => s - 1)}
                                className="flex items-center gap-2 text-[#666666] hover:text-black transition-colors font-medium"
                            >
                                <ChevronLeft size={18} /> Back
                            </button>
                        ) : <div />}

                        {step < steps.length - 1 ? (
                            <button
                                onClick={() => setStep(s => s + 1)}
                                disabled={!isStepValid()}
                                className="flex items-center gap-2 bg-black hover:bg-[#222222] disabled:bg-[#E5E5E5] disabled:text-[#999999] text-white font-medium px-6 py-3 transition-all"
                            >
                                Continue <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!isStepValid() || saving}
                                className="flex items-center gap-2 bg-black hover:bg-[#222222] disabled:bg-[#E5E5E5] disabled:text-[#999999] text-white font-medium px-6 py-3 transition-all"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                {saving ? 'Saving…' : 'Complete Profile'}
                            </button>
                        )}
                    </div>


                </div>
            </motion.div>
        </div>
    );
}
