import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Feature { icon: string; title: string; desc: string; color: string; }
interface Template { icon: string; title: string; desc: string; tags: string[]; color: string; }
interface Step { num: string; title: string; desc: string; }
interface Slide { tag: string; headline: string; sub: string; accent: string; }

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES: Feature[] = [
    { icon: '◈', title: 'Task Management', desc: 'Kanban boards, sprints, and smart task tracking with AI-powered prioritization.', color: '#6EE7F7' },
    { icon: '◉', title: 'Document Management', desc: 'Rich-text docs, version history, and real-time co-editing—all in one place.', color: '#A78BFA' },
    { icon: '⬡', title: 'AI Assistant', desc: 'Your intelligent copilot for drafting, summarizing, and automating repetitive work.', color: '#FCD34D' },
    { icon: '⬟', title: 'Team Collaboration', desc: 'Threaded chats, @mentions, and presence indicators so your team stays in sync.', color: '#6EE7B7' },
    { icon: '◎', title: 'Quick Notes', desc: 'Capture ideas instantly. Smart tagging links notes to tasks and projects automatically.', color: '#F9A8D4' },
];

const TEMPLATES: Template[] = [
    { icon: '⬡', title: 'Software Development', desc: 'Sprint planning, bug tracking, and release pipelines out of the box.', tags: ['Agile', 'Scrum', 'DevOps'], color: '#6EE7F7' },
    { icon: '◈', title: 'Marketing Campaign', desc: 'Content calendar, asset management, and campaign analytics together.', tags: ['Content', 'Social', 'Ads'], color: '#F9A8D4' },
    { icon: '◉', title: 'Content Creation', desc: 'Editorial workflow from ideation to publish, powered by AI drafting.', tags: ['Blog', 'Video', 'SEO'], color: '#A78BFA' },
    { icon: '◎', title: 'Personal Productivity', desc: 'GTD-inspired daily planner synced with your calendar and goals.', tags: ['GTD', 'Focus', 'Goals'], color: '#FCD34D' },
];

const STEPS: Step[] = [
    { num: '01', title: 'Create your first project', desc: 'Set up a workspace, choose a template, and define your goals in minutes.' },
    { num: '02', title: 'Add tasks', desc: 'Break work into actionable items, set priorities, and assign deadlines.' },
    { num: '03', title: 'Invite your team', desc: 'Send email invites or share a link. Roles and permissions auto-apply.' },
    { num: '04', title: 'Start collaborating', desc: 'Chat, comment, and co-edit in real time. AI keeps everyone aligned.' },
];

const SLIDES: Slide[] = [
    { tag: 'Task Management', headline: 'Boards that think\nahead of you.', sub: 'AI-assisted prioritization and smart due-date suggestions.', accent: '#6EE7F7' },
    { tag: 'AI Copilot', headline: 'Your smartest\nteammate.', sub: 'Draft, summarize, and automate—right inside your workflow.', accent: '#A78BFA' },
    { tag: 'Team Collaboration', headline: 'Everyone on\nthe same page.', sub: 'Real-time presence, threaded chats, and instant notifications.', accent: '#6EE7B7' },
    { tag: 'Documents', headline: 'Docs that live\nwhere work happens.', sub: 'Co-edit, version, and link directly to tasks and projects.', accent: '#FCD34D' },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────
function useInterval(cb: () => void, delay: number | null) {
    const saved = useRef(cb);
    useEffect(() => { saved.current = cb; });
    useEffect(() => {
        if (delay === null) return;
        const id = setInterval(() => saved.current(), delay);
        return () => clearInterval(id);
    }, [delay]);
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ dark, onToggle, onLogin, onSignup }: {
    dark: boolean; onToggle: () => void; onLogin: () => void; onSignup: () => void;
}) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const h = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', h);
        return () => window.removeEventListener('scroll', h);
    }, []);

    return (
        <nav
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
                transition: 'background 0.3s, border-color 0.3s',
                background: scrolled ? (dark ? 'rgba(13,17,23,0.92)' : 'rgba(255,255,255,0.92)') : 'transparent',
                backdropFilter: scrolled ? 'blur(12px)' : 'none',
                borderBottom: scrolled ? `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : '1px solid transparent',
            }}
        >
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#6EE7F7,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0D1117', fontWeight: 800, fontSize: 15 }}>D</div>
                    <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: dark ? '#F1F5F9' : '#0F172A' }}>DYUKSA</span>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={onToggle} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: dark ? '#94A3B8' : '#64748B', fontSize: 16 }}>
                        {dark ? '☀' : '🌙'}
                    </button>
                    <a href="#" style={{ fontSize: 13, fontWeight: 500, color: dark ? '#94A3B8' : '#64748B', textDecoration: 'none', display: window.innerWidth < 640 ? 'none' : 'block' }}>Docs</a>
                    <button onClick={onLogin} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', cursor: 'pointer', color: dark ? '#CBD5E1' : '#334155' }}>
                        Sign In
                    </button>
                    <button onClick={onSignup} style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#6EE7F7,#A78BFA)', color: '#0D1117' }}>
                        Sign Up
                    </button>
                </div>
            </div>
        </nav>
    );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────
function Carousel({ dark }: { dark: boolean }) {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    useInterval(() => { if (!paused) setActive(p => (p + 1) % SLIDES.length); }, 4000);
    const s = SLIDES[active];
    const bg = dark ? '#0D1117' : '#F1F5F9';

    return (
        <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, background: bg, minHeight: 300 }}
        >
            {/* Glow */}
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${s.accent}20 0%, transparent 70%)`, transition: 'background 0.6s' }} />
            {/* Text */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 24px' }}>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999, marginBottom: 24, background: `${s.accent}20`, color: s.accent, border: `1px solid ${s.accent}44` }}>{s.tag}</span>
                <h2 style={{ fontSize: 'clamp(26px,5vw,52px)', fontWeight: 900, marginBottom: 16, lineHeight: 1.1, whiteSpace: 'pre-line', color: dark ? '#F1F5F9' : '#0F172A', letterSpacing: '-0.03em' }}>{s.headline}</h2>
                <p style={{ maxWidth: 420, fontSize: 16, color: dark ? '#94A3B8' : '#64748B' }}>{s.sub}</p>
            </div>
            {/* Dots */}
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
                {SLIDES.map((sl, i) => (
                    <button key={i} onClick={() => setActive(i)} style={{ height: 8, borderRadius: 99, border: 'none', cursor: 'pointer', transition: 'width 0.3s, background 0.3s', width: i === active ? 24 : 8, background: i === active ? sl.accent : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)') }} />
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function LandingPage() {
    const [dark, setDark] = useState(true);
    const navigate = useNavigate();

    const bg = dark ? '#0D1117' : '#F8FAFC';
    const text = dark ? '#F1F5F9' : '#0F172A';
    const muted = dark ? '#475569' : '#94A3B8';
    const card = dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
    const border = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const shadow = dark ? 'none' : '0 2px 16px rgba(0,0,0,0.07)';

    const section: React.CSSProperties = { maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem 80px' };

    return (
        <div style={{ background: bg, color: text, minHeight: '100vh', fontFamily: "'DM Sans','Inter',sans-serif", transition: 'background 0.3s, color 0.3s' }}>
            {/* Font */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');`}</style>

            <Navbar dark={dark} onToggle={() => setDark(d => !d)} onLogin={() => navigate('/login')} onSignup={() => navigate('/signup')} />

            {/* ── HERO ──────────────────────────────────────────────────────────── */}
            <section style={{ position: 'relative', paddingTop: 128, paddingBottom: 64, overflow: 'hidden' }}>
                {/* Ambient */}
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, opacity: 0.18, pointerEvents: 'none', background: 'radial-gradient(ellipse at center,#6EE7F7 0%,#A78BFA 40%,transparent 70%)', filter: 'blur(60px)' }} />
                <div style={{ ...section, textAlign: 'center', position: 'relative', zIndex: 1, paddingBottom: 0 }}>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 14px', borderRadius: 999, marginBottom: 24, background: 'rgba(110,231,247,0.12)', color: '#6EE7F7', border: '1px solid rgba(110,231,247,0.3)' }}>All-in-one Workspace</span>
                    <h1 style={{ fontSize: 'clamp(32px,6vw,64px)', fontWeight: 900, marginBottom: 20, lineHeight: 1.08, letterSpacing: '-0.035em' }}>
                        The workspace your{' '}
                        <span style={{ background: 'linear-gradient(135deg,#6EE7F7,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>team</span>
                        {' '}actually loves.
                    </h1>
                    <p style={{ fontSize: 18, color: muted, maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.6 }}>Tasks, documents, AI assistance, and team chat — unified in DYUKSA, powered by Zanflow.</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <button onClick={() => navigate('/projects')} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: 'linear-gradient(135deg,#6EE7F7,#A78BFA)', color: '#0D1117' }}>
                            Create Project →
                        </button>
                        <button style={{ padding: '12px 28px', borderRadius: 12, border: `1px solid ${border}`, cursor: 'pointer', fontWeight: 600, fontSize: 14, background: card, color: text }}>
                            Explore Templates
                        </button>
                    </div>
                </div>
            </section>

            {/* ── CAROUSEL ──────────────────────────────────────────────────────── */}
            <div style={{ ...section, paddingTop: 48 }}>
                <Carousel dark={dark} />
            </div>

            {/* ── FEATURES ──────────────────────────────────────────────────────── */}
            <section style={section}>
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <h2 style={{ fontSize: 'clamp(22px,4vw,40px)', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.025em' }}>Everything your team needs</h2>
                    <p style={{ color: muted }}>Built for speed, designed for clarity.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 16 }}>
                    {FEATURES.map(f => (
                        <div key={f.title} style={{ borderRadius: 16, padding: '24px', background: card, border: `1px solid ${border}`, boxShadow: shadow, transition: 'transform 0.2s' }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.color}18`, color: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
                            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: dark ? '#E2E8F0' : '#1E293B' }}>{f.title}</h3>
                            <p style={{ fontSize: 13, lineHeight: 1.6, color: muted }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── TEMPLATES ─────────────────────────────────────────────────────── */}
            <section style={section}>
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <h2 style={{ fontSize: 'clamp(22px,4vw,40px)', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.025em' }}>Start from a template</h2>
                    <p style={{ color: muted }}>Pick a workflow, hit go.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
                    {TEMPLATES.map(t => (
                        <div key={t.title} style={{ borderRadius: 16, overflow: 'hidden', background: card, border: `1px solid ${border}`, boxShadow: shadow, transition: 'transform 0.2s', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                            <div style={{ height: 88, background: `${t.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: t.color }}>{t.icon}</div>
                            <div style={{ padding: 20 }}>
                                <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: dark ? '#E2E8F0' : '#1E293B' }}>{t.title}</h3>
                                <p style={{ fontSize: 12, lineHeight: 1.6, color: muted, marginBottom: 12 }}>{t.desc}</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                    {t.tags.map(tag => (
                                        <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: `${t.color}18`, color: t.color }}>{tag}</span>
                                    ))}
                                </div>
                                <button style={{ width: '100%', padding: '8px', borderRadius: 10, border: `1px solid ${t.color}33`, background: `${t.color}14`, color: t.color, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                                    Use Template →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── QUICK ACTIONS ─────────────────────────────────────────────────── */}
            <section style={section}>
                <div style={{ borderRadius: 20, padding: '48px 40px', background: card, border: `1px solid ${border}` }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <h2 style={{ fontSize: 'clamp(20px,3vw,32px)', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>Quick Actions</h2>
                        <p style={{ color: muted }}>Jump straight into what matters.</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 16 }}>
                        {[
                            { icon: '◈', label: 'Create Project', color: '#6EE7F7', path: '/projects' },
                            { icon: '⬡', label: 'Invite Team', color: '#A78BFA', path: '/admin/user-roles' },
                            { icon: '◉', label: 'Upload Documents', color: '#6EE7B7', path: '/documents' },
                            { icon: '⬟', label: 'Start with AI', color: '#FCD34D', path: '/quick-notes' },
                        ].map(a => (
                            <button key={a.label} onClick={() => navigate(a.path)}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 12px', borderRadius: 16, border: `1px solid ${a.color}25`, background: `${a.color}0E`, cursor: 'pointer', transition: 'transform 0.2s' }}
                                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                                <span style={{ fontSize: 28, color: a.color }}>{a.icon}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: a.color, textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── ONBOARDING STEPS ──────────────────────────────────────────────── */}
            <section style={section}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 48, alignItems: 'start' }}>
                    <div>
                        <h2 style={{ fontSize: 'clamp(22px,4vw,40px)', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Up and running<br />in minutes.</h2>
                        <p style={{ color: muted, lineHeight: 1.7, marginBottom: 32 }}>No lengthy setup. No complex configuration. DYUKSA gets out of your way so your team can focus.</p>
                        <button onClick={() => navigate('/projects')} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: 'linear-gradient(135deg,#6EE7F7,#A78BFA)', color: '#0D1117' }}>
                            Get Started Free →
                        </button>
                    </div>
                    <div>
                        {STEPS.map((s, i) => (
                            <div key={s.num} style={{ display: 'flex', gap: 20, position: 'relative', paddingBottom: i < STEPS.length - 1 ? 32 : 0 }}>
                                {i < STEPS.length - 1 && <div style={{ position: 'absolute', left: 23, top: 48, bottom: 0, width: 1, background: border }} />}
                                <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, background: 'rgba(110,231,247,0.1)', color: '#6EE7F7', border: '1px solid rgba(110,231,247,0.25)', position: 'relative', zIndex: 1 }}>{s.num}</div>
                                <div>
                                    <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: dark ? '#E2E8F0' : '#1E293B' }}>{s.title}</h3>
                                    <p style={{ fontSize: 13, lineHeight: 1.6, color: muted }}>{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA BANNER ────────────────────────────────────────────────────── */}
            <section style={section}>
                <div style={{ borderRadius: 20, padding: 'clamp(40px,6vw,72px) 40px', textAlign: 'center', position: 'relative', overflow: 'hidden', background: dark ? 'rgba(110,231,247,0.05)' : 'rgba(110,231,247,0.08)', border: '1px solid rgba(110,231,247,0.2)' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 50%,rgba(167,139,250,0.14) 0%,transparent 70%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h2 style={{ fontSize: 'clamp(22px,4vw,40px)', fontWeight: 900, marginBottom: 16, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Ready to transform how<br />your team works?</h2>
                        <p style={{ color: muted, marginBottom: 32, fontSize: 16 }}>Join thousands of teams already building better together.</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <button onClick={() => navigate('/signup')} style={{ padding: '13px 32px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: 'linear-gradient(135deg,#6EE7F7,#A78BFA)', color: '#0D1117' }}>
                                Sign Up — it's free
                            </button>
                            <button onClick={() => navigate('/login')} style={{ padding: '13px 32px', borderRadius: 12, border: `1px solid ${border}`, cursor: 'pointer', fontWeight: 600, fontSize: 14, background: card, color: text }}>
                                Sign In
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ borderTop: `1px solid ${border}`, padding: '32px 24px', textAlign: 'center', fontSize: 12, color: muted }}>
                © {new Date().getFullYear()} DYUKSA · Powered by Zanflow
            </footer>
        </div>
    );
}

export default LandingPage;