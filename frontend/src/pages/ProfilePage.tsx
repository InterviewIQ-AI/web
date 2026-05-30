import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Briefcase, GraduationCap, Link2,
  Target, Star, Edit3, Check, X, Plus, Trash2, Calendar,
  Shield, Loader2, CheckCircle, AlertCircle, FileText, UploadCloud,
} from 'lucide-react';
import { useAuth, getIdToken } from '../context/AuthContext';

/* ─── Types ──────────────────────────────────────────────── */
interface FormState {
  name: string;
  phone: string;
  currentRole: string;
  yearsOfExperience: string;
  targetRole: string;
  education: string;
  linkedinUrl: string;
  skills: string[];
}

/* ─── Small helpers ───────────────────────────────────────── */
function Field({
  icon: Icon,
  label,
  value,
  editing,
  name,
  type = 'text',
  placeholder,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  editing: boolean;
  name: string;
  type?: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="profile-field">
      <div className="profile-field-label">
        <Icon size={14} className="field-icon" />
        <span>{label}</span>
      </div>
      {editing ? (
        <input
          type={type}
          name={name}
          value={value}
          placeholder={placeholder ?? label}
          onChange={onChange}
          className="profile-input"
        />
      ) : (
        <p className={`profile-value ${!value ? 'empty' : ''}`}>
          {value || '—'}
        </p>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function ProfilePage() {
  const { user, dbUser, refreshDbUser } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const skillInputRef = useRef<HTMLInputElement>(null);

  // ── Resume state ──────────────────────────────────────────
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeDragging, setResumeIsDragging] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetResume = (f: File) => {
    if (f.type !== 'application/pdf') { setResumeError('Only PDF files are supported.'); return; }
    if (f.size > 5 * 1024 * 1024) { setResumeError('File must be under 5 MB.'); return; }
    setResumeError('');
    setResumeFile(f);
  };

  const handleResumeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setResumeIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetResume(f);
  };

  const handleResumeUpload = async () => {
    if (!resumeFile) return;
    setResumeUploading(true);
    setResumeError('');
    try {
      const token = await getIdToken();
      const formData = new FormData();
      formData.append('file', resumeFile);
      const res = await fetch('/api/users/resume', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? 'Upload failed');
      }
      await refreshDbUser();
      setResumeFile(null);
      showToast('success', 'Resume saved to your profile!');
    } catch (e: unknown) {
      setResumeError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setResumeUploading(false);
    }
  };

  const handleResumeRemove = async () => {
    setResumeUploading(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText: null }),
      });
      if (!res.ok) throw new Error('Failed to remove resume');
      await refreshDbUser();
      setResumeFile(null);
      showToast('success', 'Resume removed from your profile.');
    } catch {
      showToast('error', 'Could not remove resume. Please try again.');
    } finally {
      setResumeUploading(false);
    }
  };

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    currentRole: '',
    yearsOfExperience: '',
    targetRole: '',
    education: '',
    linkedinUrl: '',
    skills: [],
  });

  // Populate form when dbUser loads
  useEffect(() => {
    if (dbUser) {
      setForm({
        name: dbUser.name ?? '',
        phone: dbUser.phone ?? '',
        currentRole: dbUser.currentRole ?? '',
        yearsOfExperience: dbUser.yearsOfExperience?.toString() ?? '',
        targetRole: dbUser.targetRole ?? '',
        education: dbUser.education ?? '',
        linkedinUrl: dbUser.linkedinUrl ?? '',
        skills: dbUser.skills ?? [],
      });
    }
  }, [dbUser]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddSkill = () => {
    const s = newSkill.trim();
    if (s && !form.skills.includes(s)) {
      setForm(prev => ({ ...prev, skills: [...prev.skills, s] }));
    }
    setNewSkill('');
    skillInputRef.current?.focus();
  };

  const handleRemoveSkill = (skill: string) => {
    setForm(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); }
  };

  const handleCancel = () => {
    if (dbUser) {
      setForm({
        name: dbUser.name ?? '',
        phone: dbUser.phone ?? '',
        currentRole: dbUser.currentRole ?? '',
        yearsOfExperience: dbUser.yearsOfExperience?.toString() ?? '',
        targetRole: dbUser.targetRole ?? '',
        education: dbUser.education ?? '',
        linkedinUrl: dbUser.linkedinUrl ?? '',
        skills: dbUser.skills ?? [],
      });
    }
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      await refreshDbUser();
      setEditing(false);
      showToast('success', 'Profile updated successfully!');
    } catch {
      showToast('error', 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Avatar helpers ── */
  const initials = user?.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() ?? '?';

  const joinDate = dbUser?.createdAt
    ? new Date(dbUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="profile-page">
      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`profile-toast ${toast.type}`}
          >
            {toast.type === 'success'
              ? <CheckCircle size={16} />
              : <AlertCircle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="profile-container">
        {/* ── Left card: Avatar + quick info ── */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="profile-sidebar"
        >
          {/* Avatar */}
          <div className="avatar-wrapper">
            <div className="avatar-ring">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="avatar-img" />
              ) : (
                <div className="avatar-initials">{initials}</div>
              )}
            </div>
          </div>

          <h2 className="sidebar-name">{dbUser?.name || user?.displayName || 'Your Name'}</h2>
          <p className="sidebar-role">{dbUser?.currentRole || 'Role not set'}</p>

          <div className="sidebar-meta">
            <div className="meta-row">
              <Mail size={13} />
              <span>{dbUser?.email || user?.email || '—'}</span>
            </div>
            {dbUser?.phone && (
              <div className="meta-row">
                <Phone size={13} />
                <span>{dbUser.phone}</span>
              </div>
            )}
            <div className="meta-row">
              <Calendar size={13} />
              <span>Joined {joinDate}</span>
            </div>
            {dbUser?.profileCompleted && (
              <div className="meta-row verified">
                <Shield size={13} />
                <span>Profile complete</span>
              </div>
            )}
          </div>

          {/* Skills preview */}
          {(dbUser?.skills?.length ?? 0) > 0 && (
            <div className="sidebar-skills">
              <p className="skills-heading">Skills</p>
              <div className="skills-wrap">
                {dbUser!.skills.slice(0, 8).map(s => (
                  <span key={s} className="skill-chip-sm">{s}</span>
                ))}
                {dbUser!.skills.length > 8 && (
                  <span className="skill-chip-sm more">+{dbUser!.skills.length - 8}</span>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Right card: Editable details ── */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="profile-main"
        >
          {/* Header row */}
          <div className="main-header">
            <div>
              <h1 className="main-title">My Profile</h1>
              <p className="main-sub">Manage your personal and professional information</p>
            </div>
            <div className="header-actions">
              {editing ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="btn-cancel"
                  >
                    <X size={15} /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-save"
                  >
                    {saving
                      ? <><Loader2 size={15} className="spin" /> Saving…</>
                      : <><Check size={15} /> Save Changes</>}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="btn-edit">
                  <Edit3 size={15} /> Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* ── Section: Personal Info ── */}
          <section className="profile-section">
            <h3 className="section-title">
              <User size={16} /> Personal Information
            </h3>
            <div className="fields-grid">
              <Field icon={User} label="Full Name" name="name" value={form.name} editing={editing} onChange={handleChange} placeholder="e.g. Akash Sharma" />
              <Field icon={Mail} label="Email Address" name="email" value={dbUser?.email ?? ''} editing={false} onChange={() => {}} />
              <Field icon={Phone} label="Phone Number" name="phone" value={form.phone} editing={editing} onChange={handleChange} placeholder="+91 98765 43210" />
            </div>
          </section>

          <div className="section-divider" />

          {/* ── Section: Career ── */}
          <section className="profile-section">
            <h3 className="section-title">
              <Briefcase size={16} /> Career Details
            </h3>
            <div className="fields-grid">
              <Field icon={Briefcase} label="Current Role" name="currentRole" value={form.currentRole} editing={editing} onChange={handleChange} placeholder="e.g. Software Engineer" />
              <Field icon={Star} label="Years of Experience" name="yearsOfExperience" value={form.yearsOfExperience} editing={editing} type="number" onChange={handleChange} placeholder="e.g. 3" />
              <Field icon={Target} label="Target Role" name="targetRole" value={form.targetRole} editing={editing} onChange={handleChange} placeholder="e.g. Senior Engineer" />
              <Field icon={GraduationCap} label="Education" name="education" value={form.education} editing={editing} onChange={handleChange} placeholder="e.g. B.Tech CSE, IIT Delhi" />
              <Field icon={Link2} label="LinkedIn URL" name="linkedinUrl" value={form.linkedinUrl} editing={editing} onChange={handleChange} placeholder="https://linkedin.com/in/username" />
            </div>
          </section>

          <div className="section-divider" />

          {/* ── Section: Skills ── */}
          <section className="profile-section">
            <h3 className="section-title">
              <Star size={16} /> Skills
            </h3>

            <div className="skills-wrap full">
              {form.skills.map(skill => (
                <span key={skill} className={`skill-chip ${editing ? 'editable' : ''}`}>
                  {skill}
                  {editing && (
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="skill-remove"
                      aria-label={`Remove ${skill}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </span>
              ))}
              {form.skills.length === 0 && !editing && (
                <p className="empty-skills">No skills added yet. Click Edit Profile to add some.</p>
              )}
            </div>

            {editing && (
              <div className="skill-add-row">
                <input
                  ref={skillInputRef}
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder="Type a skill and press Enter or +"
                  className="profile-input skill-add-input"
                />
                <button onClick={handleAddSkill} className="btn-add-skill">
                  <Plus size={16} />
                </button>
              </div>
            )}
          </section>

          <div className="section-divider" />

          {/* ── Section: Resume ── */}
          <section className="profile-section">
            <h3 className="section-title">
              <FileText size={16} /> Resume
            </h3>

            {/* Current resume status */}
            {dbUser?.resumeText && !resumeFile && (
              <div className="resume-status-bar">
                <div className="resume-status-info">
                  <CheckCircle size={15} className="resume-status-icon" />
                  <div>
                    <p className="resume-status-title">Resume on file</p>
                    <p className="resume-status-meta">
                      {(dbUser.resumeText.length / 1000).toFixed(1)}k characters extracted · ready for AI interviews
                    </p>
                  </div>
                </div>
                <button onClick={handleResumeRemove} disabled={resumeUploading} className="btn-resume-remove">
                  {resumeUploading ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                  Remove
                </button>
              </div>
            )}

            {/* Drop zone */}
            <div
              onClick={() => resumeInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setResumeIsDragging(true); }}
              onDragLeave={() => setResumeIsDragging(false)}
              onDrop={handleResumeDrop}
              className={`resume-dropzone ${
                resumeDragging ? 'dragging' : resumeFile ? 'has-file' : ''
              }`}
            >
              <input
                ref={resumeInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetResume(f); e.target.value = ''; }}
              />
              <AnimatePresence mode="wait">
                {resumeFile ? (
                  <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="resume-file-preview">
                    <FileText size={28} className="resume-file-icon" />
                    <div className="resume-file-info">
                      <p className="resume-file-name">{resumeFile.name}</p>
                      <p className="resume-file-size">{(resumeFile.size / 1024).toFixed(1)} KB · PDF ready to upload</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setResumeFile(null); setResumeError(''); }}
                      className="resume-file-clear"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="resume-drop-prompt">
                    <UploadCloud size={32} className={resumeDragging ? 'dragging-icon' : 'prompt-icon'} />
                    <p className="drop-primary">
                      {resumeDragging ? 'Drop your PDF here' : dbUser?.resumeText ? 'Drop a new PDF to replace your resume' : 'Drag & drop your resume PDF here'}
                    </p>
                    <p className="drop-secondary">PDF only · Max 5 MB · click to browse</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Error */}
            {resumeError && (
              <div className="resume-error">
                <AlertCircle size={13} /> {resumeError}
              </div>
            )}

            {/* Upload button */}
            {resumeFile && (
              <button
                onClick={handleResumeUpload}
                disabled={resumeUploading}
                className="btn-resume-upload"
              >
                {resumeUploading
                  ? <><Loader2 size={16} className="spin" /> Uploading…</>
                  : <><Check size={16} /> {dbUser?.resumeText ? 'Replace Resume' : 'Save Resume'}</>}
              </button>
            )}
          </section>

          {/* ── Resume AI Summary Card ── */}
          {dbUser?.resumeSummary && (() => {
            let summary: { summary?: string; topSkills?: string[]; experience?: string; highlights?: string[] } | null = null;
            try { summary = JSON.parse(dbUser.resumeSummary); } catch { return null; }
            if (!summary) return null;
            return (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="resume-section"
                style={{ marginTop: '1.5rem' }}
              >
                <div className="resume-section-header" style={{ marginBottom: '1rem' }}>
                  <div className="resume-section-title">
                    <Star size={16} className="resume-icon" style={{ color: '#000000' }} />
                    <span style={{ color: '#000000', fontWeight: 600 }}>AI Resume Insights</span>
                  </div>
                </div>

                {summary.summary && (
                  <p style={{ fontSize: '.83rem', color: '#666666', lineHeight: 1.6, marginBottom: '1rem' }}>
                    {summary.summary}
                  </p>
                )}

                {summary.experience && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
                    <Calendar size={13} style={{ color: '#000000', flexShrink: 0 }} />
                    <span style={{ fontSize: '.78rem', color: '#000000', fontWeight: 600 }}>{summary.experience}</span>
                  </div>
                )}

                {summary.topSkills && summary.topSkills.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '.7rem', fontWeight: 700, color: '#999999', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.5rem' }}>Top Skills</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                      {summary.topSkills.map((s: string) => (
                        <span key={s} style={{ fontSize: '.72rem', fontWeight: 600, padding: '.2rem .6rem', background: '#F5F5F5', border: '1px solid #E5E5E5', color: '#000000' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {summary.highlights && summary.highlights.length > 0 && (
                  <div>
                    <p style={{ fontSize: '.7rem', fontWeight: 700, color: '#999999', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.5rem' }}>Key Highlights</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                      {summary.highlights.map((h: string) => (
                        <li key={h} style={{ fontSize: '.78rem', color: '#666666', display: 'flex', alignItems: 'flex-start', gap: '.5rem' }}>
                          <span style={{ color: '#000000', marginTop: '.15rem', flexShrink: 0 }}>✓</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.section>
            );
          })()}
        </motion.div>
      </div>

      <style>{`
        .profile-page {
          min-height: 100vh;
          background: #ffffff;
          padding: 2.5rem 1.5rem;
          font-family: 'Inter', sans-serif;
          position: relative;
        }

        .profile-container {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 1.5rem;
          position: relative;
          z-index: 1;
        }

        /* ── Toast ── */
        .profile-toast {
          position: fixed;
          top: 1.25rem; right: 1.5rem;
          z-index: 9999;
          display: flex; align-items: center; gap: .5rem;
          padding: .75rem 1.25rem;
          font-size: .85rem; font-weight: 500;
        }
        .profile-toast.success {
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          color: #1A7F37;
        }
        .profile-toast.error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #D00000;
        }

        /* ── Sidebar ── */
        .profile-sidebar {
          background: #FAFAFA;
          border: 1px solid #E5E5E5;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          position: sticky;
          top: 80px;
          height: fit-content;
        }

        /* Avatar */
        .avatar-wrapper { position: relative; margin-bottom: .5rem; }
        .avatar-ring {
          width: 100px; height: 100px;
          border-radius: 50%;
          border: 2px solid #E5E5E5;
          padding: 3px;
          background: #FFFFFF;
        }
        .avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .avatar-initials {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: #000000;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.8rem; font-weight: 700; color: white;
        }

        .sidebar-name {
          font-size: 1.1rem; font-weight: 700; color: #000000;
          text-align: center; margin: 0;
        }
        .sidebar-role {
          font-size: .8rem; color: #666666;
          text-align: center; margin: 0;
        }

        .sidebar-meta {
          width: 100%;
          display: flex; flex-direction: column; gap: .5rem;
          border-top: 1px solid #E5E5E5;
          padding-top: 1rem;
        }
        .meta-row {
          display: flex; align-items: center; gap: .5rem;
          font-size: .75rem; color: #666666;
          word-break: break-all;
        }
        .meta-row svg { flex-shrink: 0; color: #999999; }
        .meta-row.verified { color: #1A7F37; }
        .meta-row.verified svg { color: #1A7F37; }

        .sidebar-skills { width: 100%; }
        .skills-heading {
          font-size: .7rem; font-weight: 600; color: #999999;
          text-transform: uppercase; letter-spacing: .05em;
          margin-bottom: .5rem;
        }

        /* ── Main card ── */
        .profile-main {
          background: #FFFFFF;
          border: 1px solid #E5E5E5;
          padding: 2rem;
        }

        .main-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;
        }
        .main-title { font-size: 1.5rem; font-weight: 700; color: #000000; margin: 0; }
        .main-sub { font-size: .82rem; color: #999999; margin: .25rem 0 0; }

        .header-actions { display: flex; gap: .75rem; flex-shrink: 0; }

        /* Buttons */
        .btn-edit, .btn-save, .btn-cancel {
          display: flex; align-items: center; gap: .4rem;
          padding: .55rem 1.1rem;
          font-size: .83rem; font-weight: 600;
          cursor: pointer;
          transition: all .2s;
          border: none;
        }
        .btn-edit {
          background: #FFFFFF;
          color: #000000;
          border: 1px solid #E5E5E5;
        }
        .btn-edit:hover { border-color: #000000; }
        .btn-save {
          background: #000000;
          color: white;
        }
        .btn-save:hover:not(:disabled) { background: #222222; }
        .btn-save:disabled { opacity: .6; cursor: not-allowed; }
        .btn-cancel {
          background: #FFFFFF;
          color: #666666;
          border: 1px solid #E5E5E5;
        }
        .btn-cancel:hover { border-color: #000000; color: #000000; }

        /* Sections */
        .profile-section { margin-bottom: 1.75rem; }
        .section-title {
          display: flex; align-items: center; gap: .5rem;
          font-size: .82rem; font-weight: 600;
          color: #000000; text-transform: uppercase; letter-spacing: .06em;
          margin: 0 0 1.25rem;
        }
        .section-divider {
          height: 1px;
          background: #E5E5E5;
          margin: 1.75rem 0;
        }

        /* Fields */
        .fields-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.25rem;
        }
        .profile-field { display: flex; flex-direction: column; gap: .35rem; }
        .profile-field-label {
          display: flex; align-items: center; gap: .35rem;
          font-size: .72rem; font-weight: 600;
          color: #999999; text-transform: uppercase; letter-spacing: .05em;
        }
        .field-icon { color: #000000; }
        .profile-value {
          font-size: .9rem; color: #000000; line-height: 1.5;
          padding: .5rem 0;
          border-bottom: 1px solid #E5E5E5;
        }
        .profile-value.empty { color: #CCCCCC; font-style: italic; }
        .profile-input {
          background: #FFFFFF;
          border: 1px solid #E5E5E5;
          padding: .55rem .85rem;
          font-size: .88rem; color: #000000;
          outline: none;
          transition: border-color .2s;
          width: 100%;
          box-sizing: border-box;
        }
        .profile-input::placeholder { color: #CCCCCC; }
        .profile-input:focus {
          border-color: #000000;
        }

        /* Skills */
        .skills-wrap {
          display: flex; flex-wrap: wrap; gap: .45rem;
        }
        .skills-wrap.full { margin-bottom: 1rem; }
        .skill-chip {
          display: flex; align-items: center; gap: .3rem;
          padding: .3rem .75rem;
          background: #F5F5F5;
          border: 1px solid #E5E5E5;
          color: #000000;
          font-size: .78rem; font-weight: 500;
          transition: all .2s;
        }
        .skill-chip.editable:hover { border-color: #000000; }
        .skill-chip-sm {
          padding: .2rem .55rem;
          background: #F5F5F5;
          border: 1px solid #E5E5E5;
          color: #000000;
          font-size: .7rem;
        }
        .skill-chip-sm.more { color: #999999; background: #FAFAFA; }
        .skill-remove {
          background: none; border: none; cursor: pointer;
          color: #999999; padding: 0; line-height: 1;
          opacity: .7; transition: opacity .15s;
          display: flex; align-items: center;
        }
        .skill-remove:hover { opacity: 1; color: #D00000; }
        .empty-skills { font-size: .83rem; color: #CCCCCC; font-style: italic; }

        .skill-add-row {
          display: flex; gap: .5rem; align-items: center;
          margin-top: .75rem;
        }
        .skill-add-input { flex: 1; }
        .btn-add-skill {
          flex-shrink: 0;
          width: 38px; height: 38px;
          background: #000000;
          border: none; color: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background .15s;
        }
        .btn-add-skill:hover { background: #222222; }

        /* Spin animation */
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Resume section ── */
        .resume-status-bar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem;
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          padding: .85rem 1rem;
          margin-bottom: 1rem;
        }
        .resume-status-info { display: flex; align-items: center; gap: .65rem; }
        .resume-status-icon { color: #1A7F37; flex-shrink: 0; }
        .resume-status-title { font-size: .85rem; font-weight: 600; color: #1A7F37; margin: 0; }
        .resume-status-meta { font-size: .72rem; color: #1A7F37; opacity: .7; margin: .1rem 0 0; }

        .btn-resume-remove {
          display: flex; align-items: center; gap: .35rem;
          padding: .35rem .75rem;
          font-size: .75rem; font-weight: 600;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #D00000;
          cursor: pointer;
          transition: all .2s;
          flex-shrink: 0;
        }
        .btn-resume-remove:hover:not(:disabled) { background: #FEE2E2; }
        .btn-resume-remove:disabled { opacity: .5; cursor: not-allowed; }

        .resume-dropzone {
          border: 2px dashed #E5E5E5;
          padding: 2rem 1rem;
          cursor: pointer;
          transition: all .2s;
          background: #FAFAFA;
          min-height: 120px;
          display: flex; align-items: center; justify-content: center;
        }
        .resume-dropzone:hover { border-color: #000000; }
        .resume-dropzone.dragging { border-color: #000000; background: #F5F5F5; }
        .resume-dropzone.has-file { border-color: #E5E5E5; background: #FAFAFA; }

        .resume-file-preview {
          display: flex; align-items: center; gap: 1rem;
          width: 100%;
        }
        .resume-file-icon { color: #000000; flex-shrink: 0; }
        .resume-file-info { flex: 1; min-width: 0; }
        .resume-file-name { font-size: .88rem; font-weight: 600; color: #000000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
        .resume-file-size { font-size: .72rem; color: #666666; margin: .15rem 0 0; }
        .resume-file-clear {
          flex-shrink: 0; background: none; border: none;
          color: #999999; cursor: pointer; padding: .25rem;
          transition: color .15s;
        }
        .resume-file-clear:hover { color: #D00000; }

        .resume-drop-prompt {
          display: flex; flex-direction: column; align-items: center; gap: .5rem;
          text-align: center;
        }
        .prompt-icon { color: #CCCCCC; }
        .dragging-icon { color: #000000; }
        .drop-primary { font-size: .88rem; font-weight: 500; color: #666666; margin: 0; }
        .drop-secondary { font-size: .72rem; color: #999999; margin: 0; }

        .resume-error {
          display: flex; align-items: center; gap: .4rem;
          margin-top: .65rem;
          font-size: .78rem; color: #D00000;
        }

        .btn-resume-upload {
          display: flex; align-items: center; justify-content: center; gap: .45rem;
          width: 100%; margin-top: .85rem;
          padding: .7rem 1.25rem;
          font-size: .88rem; font-weight: 600;
          background: #000000;
          color: white; border: none; cursor: pointer;
          transition: all .2s;
        }
        .btn-resume-upload:hover:not(:disabled) { background: #222222; }
        .btn-resume-upload:disabled { opacity: .6; cursor: not-allowed; }

        /* Responsive */
        @media (max-width: 768px) {
          .profile-container { grid-template-columns: 1fr; }
          .profile-sidebar { position: static; }
          .fields-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
