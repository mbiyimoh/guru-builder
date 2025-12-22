import React, { useState } from 'react';

// GURU BUILDER v4 - Generic Pedagogical Dimensions
const tokens = {
  colors: {
    bg: '#FAFAFA', bgElevated: '#FFFFFF', bgSubtle: '#F5F5F7',
    text: '#1D1D1F', textSecondary: '#86868B', textTertiary: '#AEAEB2',
    border: '#E5E5EA', borderSubtle: '#F0F0F2',
    accent: '#0071E3', accentHover: '#0077ED',
    success: '#34C759', successBg: '#E8F9ED',
    warning: '#FF9500', warningBg: '#FFF4E5',
    error: '#FF3B30', errorBg: '#FFEBEB',
  },
  fonts: { body: '-apple-system, sans-serif', mono: 'SF Mono, monospace' },
  shadows: { md: '0 4px 12px rgba(0,0,0,0.08)', lg: '0 12px 40px rgba(0,0,0,0.12)' },
};

// Universal pedagogical dimensions - work for ANY domain
const INITIAL_CORPUS = {
  dimensions: [
    { id: 'foundations', name: 'Foundational Concepts', icon: '🏗️', description: 'Core principles students must understand first', question: 'What fundamentals must every beginner grasp?', items: [] },
    { id: 'progression', name: 'Learning Progression', icon: '📈', description: 'How students advance from beginner to advanced', question: 'What should students master first, second, third?', items: [] },
    { id: 'mistakes', name: 'Common Mistakes', icon: '⚠️', description: 'What learners typically get wrong', question: 'What mistakes do beginners commonly make?', items: [] },
    { id: 'examples', name: 'Concrete Examples', icon: '💡', description: 'Real scenarios and worked problems', question: 'What examples illustrate key concepts?', items: [] },
    { id: 'nuance', name: 'Edge Cases & Nuance', icon: '🎯', description: 'When rules dont apply, exceptions', question: 'When do standard rules NOT apply?', items: [] },
    { id: 'practice', name: 'Practice Patterns', icon: '🔄', description: 'What students should drill', question: 'What should students practice repeatedly?', items: [] },
  ]
};

const RESEARCH_SUGGESTIONS = [
  { id: 's1', dimension: 'foundations', priority: 'high', title: 'Core Concepts & Definitions', reason: 'Students need a solid foundation before tackling advanced topics.' },
  { id: 's2', dimension: 'mistakes', priority: 'high', title: 'Common Beginner Mistakes', reason: 'Addressing mistakes proactively helps students avoid frustrating pitfalls.' },
  { id: 's3', dimension: 'progression', priority: 'high', title: 'Learning Pathway', reason: 'A clear progression helps students know what to focus on at each stage.' },
  { id: 's4', dimension: 'examples', priority: 'medium', title: 'Worked Examples & Cases', reason: 'Concrete examples make abstract concepts tangible and memorable.' },
  { id: 's5', dimension: 'nuance', priority: 'medium', title: 'Exceptions & Edge Cases', reason: 'Understanding nuance separates competent practitioners from experts.' },
  { id: 's6', dimension: 'practice', priority: 'medium', title: 'Practice & Drill Patterns', reason: 'Knowledge without practice does not stick.' },
];

const MOCK_RECS = {
  'Core Concepts & Definitions': [
    { id: 1, title: 'Fundamental Terminology', confidence: 0.94, content: 'Essential terms every student needs...' },
    { id: 2, title: 'Key Principles Overview', confidence: 0.91, content: 'Foundational principles that govern...' },
  ],
  'Common Beginner Mistakes': [
    { id: 3, title: 'Top 5 Beginner Errors', confidence: 0.92, content: 'Most frequent errors beginners make...' },
    { id: 4, title: 'Misconceptions to Unlearn', confidence: 0.88, content: 'Things beginners believe that are wrong...' },
  ],
  'Learning Pathway': [
    { id: 5, title: 'Beginner Stage Focus', confidence: 0.89, content: 'What to focus on first...' },
    { id: 6, title: 'Intermediate Progression', confidence: 0.87, content: 'Once fundamentals are solid...' },
  ],
};

const EXAMPLE_GURUS = [
  { id: 'bg', name: 'Backgammon Mastery', icon: '♟️', author: 'Paul M.', style: 'Socratic' },
  { id: 'jazz', name: 'Jazz Improvisation', icon: '🎸', author: 'Maria S.', style: 'Encouraging' },
  { id: 'excel', name: 'Excel for Finance', icon: '📊', author: 'Tom K.', style: 'Direct' },
];

const MOCK_PROFILE = { domain: 'Backgammon', audience: 'Club players', approach: 'Socratic', tone: 'encouraging', perspective: 'Magriel + computer precision' };

// Shared Components
const Button = ({ children, variant = 'primary', size = 'md', disabled, onClick, style = {} }) => {
  const [h, setH] = useState(false);
  const variants = {
    primary: { background: h && !disabled ? tokens.colors.accentHover : tokens.colors.accent, color: '#FFF', border: 'none' },
    secondary: { background: h ? tokens.colors.bgSubtle : 'transparent', color: tokens.colors.text, border: `1px solid ${tokens.colors.border}` },
    ghost: { background: h ? tokens.colors.bgSubtle : 'transparent', color: tokens.colors.accent, border: 'none' },
  };
  const sizes = { sm: { padding: '8px 16px', fontSize: '13px' }, md: { padding: '12px 24px', fontSize: '15px' } };
  return (
    <button onClick={disabled ? undefined : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ ...variants[variant], ...sizes[size], fontFamily: tokens.fonts.body, fontWeight: '500', borderRadius: '980px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, outline: 'none', transition: 'all 150ms', ...style }}>
      {children}
    </button>
  );
};

const Card = ({ children, elevated, onClick, style = {} }) => (
  <div onClick={onClick} style={{
    background: elevated ? tokens.colors.bgElevated : tokens.colors.bgSubtle, borderRadius: '16px', padding: '24px',
    boxShadow: elevated ? tokens.shadows.md : 'none', border: elevated ? 'none' : `1px solid ${tokens.colors.borderSubtle}`,
    cursor: onClick ? 'pointer' : 'default', transition: 'all 150ms', ...style,
  }}>{children}</div>
);

const Badge = ({ children, variant = 'default' }) => {
  const v = { default: { bg: tokens.colors.bgSubtle, c: tokens.colors.textSecondary }, success: { bg: tokens.colors.successBg, c: tokens.colors.success },
    warning: { bg: tokens.colors.warningBg, c: tokens.colors.warning }, error: { bg: tokens.colors.errorBg, c: tokens.colors.error },
    accent: { bg: 'rgba(0,113,227,0.1)', c: tokens.colors.accent } }[variant];
  return <span style={{ padding: '4px 10px', borderRadius: '980px', fontSize: '12px', fontWeight: '500', background: v.bg, color: v.c }}>{children}</span>;
};

const Modal = ({ isOpen, onClose, title, children, width = '600px' }) => {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }} onClick={onClose}>
      <div style={{ background: tokens.colors.bgElevated, borderRadius: '20px', width, maxWidth: '90vw', maxHeight: '85vh', overflow: 'hidden', boxShadow: tokens.shadows.lg, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', color: tokens.colors.textSecondary, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '24px', overflow: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
};

const ProgressBar = ({ value, color = tokens.colors.accent, height = 6 }) => (
  <div style={{ height, background: tokens.colors.border, borderRadius: height / 2, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: height / 2, transition: 'width 300ms' }} />
  </div>
);

const ChatBubble = ({ role, children }) => (
  <div style={{ alignSelf: role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
    <div style={{ padding: '12px 16px', borderRadius: role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
      background: role === 'user' ? tokens.colors.accent : tokens.colors.bgSubtle, color: role === 'user' ? '#FFF' : tokens.colors.text,
      fontSize: '15px', lineHeight: '1.5' }}>{children}</div>
  </div>
);

const Spinner = ({ size = 48 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', border: `3px solid ${tokens.colors.borderSubtle}`, borderTopColor: tokens.colors.accent, animation: 'spin 1s linear infinite', margin: '0 auto' }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Welcome Screen
const WelcomeScreen = ({ onContinue, onViewExamples }) => (
  <div style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
    <div style={{ fontSize: '72px', marginBottom: '24px' }}>🎓</div>
    <h1 style={{ fontSize: '32px', fontWeight: '600', marginBottom: '16px' }}>Welcome to Guru Builder</h1>
    <p style={{ fontSize: '18px', color: tokens.colors.textSecondary, lineHeight: '1.6', marginBottom: '40px' }}>
      Create an AI teaching assistant that thinks and teaches like you.
    </p>
    <Card style={{ textAlign: 'left', marginBottom: '32px' }}>
      <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
        Your guru will:<br/>✓ Answer questions in your voice<br/>✓ Generate curriculum from your approach<br/>✓ Create practice drills<br/>✓ Adapt to each student
      </div>
    </Card>
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
      <Button variant="secondary" onClick={onViewExamples}>See Examples</Button>
      <Button onClick={onContinue}>Start Building →</Button>
    </div>
  </div>
);

// Example Gallery
const ExampleGallery = ({ onClose, onUseTemplate }) => {
  const [selected, setSelected] = useState(null);
  if (selected) {
    const g = EXAMPLE_GURUS.find(x => x.id === selected);
    return (
      <div style={{ padding: '24px 0' }}>
        <Button variant="ghost" onClick={() => setSelected(null)} style={{ marginBottom: '24px' }}>← Back</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <span style={{ fontSize: '48px' }}>{g.icon}</span>
          <div><h2 style={{ fontSize: '24px', fontWeight: '600' }}>{g.name}</h2><p style={{ color: tokens.colors.textSecondary }}>{g.author} • {g.style}</p></div>
        </div>
        <Button onClick={() => onUseTemplate(g)}>Use as Template →</Button>
      </div>
    );
  }
  return (
    <div style={{ padding: '24px 0' }}>
      <Button variant="ghost" onClick={onClose} style={{ marginBottom: '24px' }}>← Back</Button>
      <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '32px' }}>Example Gurus</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {EXAMPLE_GURUS.map(g => (
          <Card key={g.id} elevated onClick={() => setSelected(g.id)} style={{ cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>{g.icon}</div>
            <h3 style={{ fontSize: '17px', fontWeight: '600' }}>{g.name}</h3>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Profile Creation
const ProfileCreation = ({ onComplete, initialProfile }) => {
  const [step, setStep] = useState('choose');
  const [profile, setProfile] = useState(initialProfile || MOCK_PROFILE);
  const [chat, setChat] = useState([{ role: 'assistant', content: 'Tell me about the guru you want to create. What subject will it teach, and who is your ideal student?' }]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [recording, setRecording] = useState(false);
  const isEditing = step === 'edit';

  const handleChat = () => {
    if (!input.trim()) return;
    setChat([...chat, { role: 'user', content: input }]);
    setInput('');
    setTimeout(() => {
      setChat(c => [...c, { role: 'assistant', content: 'Let me synthesize that...' }]);
      setTimeout(() => setStep('synth'), 1000);
      setTimeout(() => setStep('review'), 3000);
    }, 500);
  };

  if (step === 'choose') return (
    <div style={{ padding: '24px 0' }}>
      <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '32px' }}>Create Your Guru</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[{ id: 'chat', icon: '💬', title: 'Chat', desc: 'Type your responses' },
          { id: 'import', icon: '📄', title: 'Import', desc: 'Upload docs' },
          { id: 'voice', icon: '🎙', title: 'Voice', desc: 'Speak answers' }].map(m => (
          <Card key={m.id} elevated onClick={() => setStep(m.id)} style={{ cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>{m.icon}</div>
            <h3 style={{ fontSize: '17px', fontWeight: '600', marginBottom: '4px' }}>{m.title}</h3>
            <p style={{ fontSize: '14px', color: tokens.colors.textSecondary }}>{m.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );

  if (step === 'chat') return (
    <div style={{ padding: '24px 0' }}>
      <Button variant="ghost" onClick={() => setStep('choose')} style={{ marginBottom: '24px' }}>← Back</Button>
      <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '24px' }}>Describe Your Guru</h2>
      <Card elevated>
        <div style={{ height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {chat.map((m, i) => <ChatBubble key={i} role={m.role}>{m.content}</ChatBubble>)}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()}
            placeholder="Type your response..." style={{ flex: 1, padding: '12px 16px', borderRadius: '980px', border: `1px solid ${tokens.colors.border}`, fontSize: '15px', outline: 'none' }} />
          <Button onClick={handleChat}>Send</Button>
        </div>
      </Card>
    </div>
  );

  if (step === 'import') return (
    <div style={{ padding: '24px 0' }}>
      <Button variant="ghost" onClick={() => setStep('choose')} style={{ marginBottom: '24px' }}>← Back</Button>
      <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '24px' }}>Import Your Content</h2>
      <Card elevated style={{ marginBottom: '24px' }}>
        <div onClick={() => setFiles([{ name: 'Teaching_Philosophy.pdf', status: 'ready' }, { name: 'Course_Notes.docx', status: 'ready' }])}
          style={{ border: `2px dashed ${tokens.colors.border}`, borderRadius: '12px', padding: '48px', textAlign: 'center', cursor: 'pointer', background: tokens.colors.bgSubtle }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
          <p style={{ fontSize: '17px', fontWeight: '500', marginBottom: '8px' }}>Drop files here or click to browse</p>
          <p style={{ fontSize: '14px', color: tokens.colors.textSecondary }}>PDFs, Word docs, text files, even books</p>
        </div>
        {files.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '12px' }}>Uploaded files:</div>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: tokens.colors.bgSubtle, borderRadius: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <span style={{ fontWeight: '500' }}>{f.name}</span>
                </div>
                <Badge variant="success">✓ Ready</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
      {files.length > 0 && (
        <div>
          <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, marginBottom: '16px' }}>
            We'll extract your teaching style, key concepts, and approach from these documents.
          </p>
          <Button onClick={() => { setStep('synth'); setTimeout(() => setStep('review'), 3000); }}>Analyze Content →</Button>
        </div>
      )}
    </div>
  );

  if (step === 'voice') {
    const questions = [
      "What domain do you teach, and who is your ideal student?",
      "What's your teaching philosophy? How do you approach helping someone learn?",
      "What makes your perspective unique? What do you know that others don't?",
      "What's the biggest mistake beginners make, and how do you help them avoid it?",
      "Describe your ideal teaching moment — when a student really 'gets it'."
    ];
    const [questionIndex, setQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState([]);
    const isLastQuestion = questionIndex === questions.length - 1;
    const hasAnswered = answers.length > questionIndex;
    
    const handleFinishRecording = () => {
      setRecording(false);
      setAnswers([...answers, { question: questions[questionIndex], duration: '0:23' }]);
    };
    
    const handleNext = () => {
      if (isLastQuestion) {
        setStep('synth');
        setTimeout(() => setStep('review'), 3000);
      } else {
        setQuestionIndex(questionIndex + 1);
      }
    };
    
    return (
      <div style={{ padding: '24px 0' }}>
        <Button variant="ghost" onClick={() => setStep('choose')} style={{ marginBottom: '24px' }}>← Back</Button>
        <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '24px' }}>Speak Your Expertise</h2>
        
        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {questions.map((_, i) => (
            <div key={i} style={{ 
              flex: 1, height: '4px', borderRadius: '2px',
              background: i < questionIndex ? tokens.colors.accent : i === questionIndex ? tokens.colors.accent : tokens.colors.border,
              opacity: i <= questionIndex ? 1 : 0.3
            }} />
          ))}
        </div>
        
        <Card elevated style={{ textAlign: 'center', marginBottom: '24px' }}>
          {/* Question number */}
          <div style={{ fontSize: '13px', color: tokens.colors.textTertiary, marginBottom: '8px' }}>
            Question {questionIndex + 1} of {questions.length}
          </div>
          
          {/* Current question */}
          <div style={{ fontSize: '20px', fontWeight: '500', marginBottom: '32px', lineHeight: '1.4' }}>
            "{questions[questionIndex]}"
          </div>
          
          {/* Microphone button */}
          <div 
            onClick={() => recording ? handleFinishRecording() : setRecording(true)}
            style={{ 
              width: '88px', height: '88px', borderRadius: '50%', margin: '0 auto',
              background: recording ? tokens.colors.error : tokens.colors.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 150ms',
              boxShadow: recording ? '0 0 0 8px rgba(255,59,48,0.15), 0 0 0 16px rgba(255,59,48,0.08)' : '0 4px 12px rgba(0,113,227,0.3)'
            }}>
            <span style={{ fontSize: '36px' }}>{recording ? '⏹' : '🎙'}</span>
          </div>
          
          {/* Recording status */}
          <p style={{ fontSize: '14px', color: recording ? tokens.colors.error : tokens.colors.textSecondary, marginTop: '16px', fontWeight: recording ? '500' : '400' }}>
            {recording ? 'Recording... tap to finish' : hasAnswered ? '✓ Recorded — tap to re-record' : 'Tap to start recording'}
          </p>
          
          {/* Waveform when recording */}
          {recording && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3px', marginTop: '16px', height: '40px' }}>
              {[...Array(16)].map((_, i) => (
                <div key={i} style={{ 
                  width: '3px', 
                  height: `${12 + Math.sin(Date.now() / 200 + i) * 14 + Math.random() * 10}px`,
                  background: tokens.colors.error, 
                  borderRadius: '2px',
                  transition: 'height 100ms'
                }} />
              ))}
            </div>
          )}
          
          {/* Next question preview */}
          {!isLastQuestion && (
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${tokens.colors.borderSubtle}` }}>
              <div style={{ fontSize: '11px', color: tokens.colors.textTertiary, textTransform: 'uppercase', marginBottom: '8px' }}>
                Up next
              </div>
              <div style={{ fontSize: '14px', color: tokens.colors.textTertiary, lineHeight: '1.4' }}>
                "{questions[questionIndex + 1]}"
              </div>
            </div>
          )}
          
          {isLastQuestion && hasAnswered && (
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${tokens.colors.borderSubtle}` }}>
              <div style={{ fontSize: '14px', color: tokens.colors.success }}>
                ✓ All questions answered! Ready to create your profile.
              </div>
            </div>
          )}
        </Card>
        
        {/* Previous answers */}
        {answers.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '12px' }}>Your answers:</div>
            {answers.map((a, i) => (
              <div key={i} style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: tokens.colors.bgSubtle, borderRadius: '8px', marginBottom: '8px' 
              }}>
                <div style={{ fontSize: '14px', color: tokens.colors.textSecondary, flex: 1, marginRight: '16px' }}>
                  Q{i + 1}: {a.question.substring(0, 50)}...
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: tokens.colors.textTertiary }}>{a.duration}</span>
                  <Badge variant="success">✓</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            variant="secondary" 
            onClick={() => setQuestionIndex(Math.max(0, questionIndex - 1))}
            disabled={questionIndex === 0}
          >
            ← Previous
          </Button>
          <Button 
            onClick={handleNext}
            disabled={!hasAnswered}
          >
            {isLastQuestion ? 'Create Profile →' : 'Next Question →'}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'synth') return <div style={{ padding: '80px 24px', textAlign: 'center' }}><Spinner /><p style={{ marginTop: '24px' }}>Synthesizing profile...</p></div>;

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '600' }}>Your Guru's Profile</h2>
        <Button variant="secondary" onClick={() => setStep(isEditing ? 'review' : 'edit')}>{isEditing ? 'Done' : 'Edit'}</Button>
      </div>
      <Card elevated style={{ marginBottom: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          {[{ k: 'domain', l: 'Domain' }, { k: 'audience', l: 'Audience' }, { k: 'approach', l: 'Approach' }, { k: 'tone', l: 'Tone' }].map(f => (
            <div key={f.k}>
              <div style={{ fontSize: '11px', color: tokens.colors.textTertiary, textTransform: 'uppercase', marginBottom: '6px' }}>{f.l}</div>
              {isEditing ? <input value={profile[f.k]} onChange={e => setProfile({ ...profile, [f.k]: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, fontSize: '14px', boxSizing: 'border-box' }} />
                : <div style={{ fontSize: '15px' }}>{profile[f.k]}</div>}
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={onComplete}>Continue to Knowledge →</Button></div>
    </div>
  );
};

// Corpus Explorer with Pedagogical Dimensions
const CorpusExplorer = ({ isOpen, onClose, corpus, onResearch }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Your Guru's Knowledge" width="750px">
    <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, marginBottom: '24px' }}>
      Great teaching content covers these pedagogical dimensions. See what your guru knows and where gaps exist.
    </p>
    {corpus.dimensions.map(dim => (
      <div key={dim.id} style={{ padding: '16px', background: tokens.colors.bgSubtle, borderRadius: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{dim.icon}</span>
            <span style={{ fontWeight: '500' }}>{dim.name}</span>
          </div>
          <Badge variant={dim.items.length > 0 ? 'success' : 'warning'}>
            {dim.items.length > 0 ? `${dim.items.length} items` : 'Gap'}
          </Badge>
        </div>
        <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: 0 }}>{dim.description}</p>
        {dim.items.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.borderSubtle}` }}>
            <span style={{ fontSize: '12px', color: tokens.colors.textTertiary, fontStyle: 'italic' }}>"{dim.question}"</span>
            <Button variant="ghost" size="sm" onClick={() => { onClose(); onResearch(dim.id); }}>Research →</Button>
          </div>
        )}
        {dim.items.length > 0 && dim.items.map(item => (
          <div key={item.id} style={{ padding: '8px 12px', background: tokens.colors.bgElevated, borderRadius: '6px', fontSize: '13px', marginTop: '8px' }}>{item.name}</div>
        ))}
      </div>
    ))}
  </Modal>
);

// Rich research plan templates - domain-aware and specific
const generateResearchPlan = (dimensionId, domain = 'Backgammon') => {
  const plans = {
    foundations: {
      title: 'Core Concepts & Definitions',
      queries: [
        `What are the 10-15 most essential terms and concepts a beginner must understand to start learning ${domain}?`,
        `What mental models do experts use to think about ${domain} that beginners often lack?`,
        `What are the foundational principles that underpin all advanced ${domain} techniques?`
      ],
      focus: `Build a comprehensive glossary and conceptual foundation for ${domain}. Focus on terms that appear repeatedly in instruction, concepts that unlock understanding of more advanced topics, and the "aha moments" that separate confused beginners from students who "get it."`,
      sources: ['Authoritative textbooks', 'Expert interviews', 'Beginner FAQ compilations'],
      outputFormat: 'Definitions with examples, conceptual diagrams, prerequisite mappings'
    },
    mistakes: {
      title: 'Common Beginner Mistakes',
      queries: [
        `What are the most common mistakes beginners make when learning ${domain}, and why do they make them?`,
        `What misconceptions do ${domain} beginners typically hold that experts had to unlearn?`,
        `What "obvious" things do beginners try that experienced practitioners know never work?`
      ],
      focus: `Identify the predictable failure modes in learning ${domain}. For each mistake, capture: what the student does wrong, why it seems right to them, what the correct approach is, and how to recognize/prevent the error.`,
      sources: ['Instructor forums', 'Student feedback', 'Competition analysis'],
      outputFormat: 'Mistake patterns with corrections, warning signs, prevention strategies'
    },
    progression: {
      title: 'Learning Pathway',
      queries: [
        `What is the optimal sequence for learning ${domain} skills? What must be mastered before what?`,
        `How do ${domain} experts describe the journey from beginner to intermediate to advanced?`,
        `What milestones indicate a student is ready to move to the next level in ${domain}?`
      ],
      focus: `Map the learning journey for ${domain}. Identify prerequisite relationships, skill progressions, and the natural plateaus students hit. Create clear stage gates so students know where they are and what to focus on next.`,
      sources: ['Curriculum designs', 'Skill taxonomies', 'Expert progression stories'],
      outputFormat: 'Staged curriculum, prerequisite graphs, milestone checklists'
    },
    examples: {
      title: 'Worked Examples & Cases',
      queries: [
        `What are the canonical examples used to teach ${domain} concepts? The ones every student should study?`,
        `What real-world ${domain} scenarios best illustrate the principles in action?`,
        `What memorable case studies do ${domain} instructors use to make abstract concepts concrete?`
      ],
      focus: `Collect the "teaching examples" that make ${domain} concepts click. These should be concrete, memorable, and reusable. Include both classic examples every practitioner knows and novel ones that illuminate tricky concepts.`,
      sources: ['Textbook examples', 'Famous cases', 'Instructor favorites'],
      outputFormat: 'Annotated examples, step-by-step breakdowns, principle mappings'
    },
    nuance: {
      title: 'Exceptions & Edge Cases',
      queries: [
        `When do the standard rules of ${domain} NOT apply? What are the exceptions experts know?`,
        `What ${domain} situations require judgment that can't be reduced to simple rules?`,
        `What do advanced ${domain} practitioners know that contradicts beginner-level advice?`
      ],
      focus: `Capture the nuance that separates competent practitioners from true experts in ${domain}. These are the "it depends" situations, the contextual judgments, and the advanced techniques that only work in specific conditions.`,
      sources: ['Expert discussions', 'Advanced texts', 'Edge case compilations'],
      outputFormat: 'Conditional rules, decision frameworks, context-dependent guidance'
    },
    practice: {
      title: 'Practice & Drill Patterns',
      queries: [
        `What specific drills and exercises build ${domain} skills most effectively?`,
        `How should students practice ${domain} to build lasting skill rather than just temporary performance?`,
        `What deliberate practice routines do ${domain} experts recommend?`
      ],
      focus: `Design practice regimens that build real ${domain} skill. Focus on drills that target specific sub-skills, exercises with clear feedback loops, and practice structures that prevent bad habit formation.`,
      sources: ['Training programs', 'Deliberate practice research', 'Coach recommendations'],
      outputFormat: 'Drill specifications, practice schedules, progress metrics'
    }
  };
  return plans[dimensionId] || plans.foundations;
};

// Research Phase with Rich Plans and Interactive Refinement
const ResearchPhase = ({ corpus, setCorpus, onProceedToReadiness, profile }) => {
  const [view, setView] = useState('home');
  const [showCorpus, setShowCorpus] = useState(false);
  const [currentResearch, setCurrentResearch] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState(null);
  const [researchHistory, setResearchHistory] = useState([]);

  const domain = profile?.domain || 'Backgammon';
  const totalKnowledge = corpus.dimensions.reduce((sum, d) => sum + d.items.length, 0);
  const coveredDimensions = corpus.dimensions.filter(d => d.items.length > 0);
  const gaps = corpus.dimensions.filter(d => d.items.length === 0);

  const startResearch = (title, dimensionId) => {
    const richPlan = generateResearchPlan(dimensionId, domain);
    setCurrentResearch({ title: richPlan.title, dimensionId });
    setPlan(richPlan);
    setChat([
      { role: 'assistant', content: `I've drafted a research plan for **${richPlan.title}** focused on ${domain}. This will search for content to fill this pedagogical gap.\n\nTake a look at the plan on the right — you can ask me to adjust the focus, add specific queries, or change what sources we prioritize.` }
    ]);
    setView('assistant');
  };

  const handleChatRefinement = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setChat([...chat, { role: 'user', content: userMsg }]);
    setInput('');
    
    // Simulate plan refinement based on user input
    setTimeout(() => {
      let response = '';
      let updatedPlan = { ...plan };
      
      if (userMsg.toLowerCase().includes('cube') || userMsg.toLowerCase().includes('doubling')) {
        updatedPlan.queries = [
          ...plan.queries,
          `How does the doubling cube affect ${domain} strategy and decision-making?`
        ];
        updatedPlan.focus = plan.focus + ` Pay special attention to cube-related decisions and how they change the strategic landscape.`;
        response = `Good call! I've added a query specifically about the doubling cube and updated the focus to prioritize cube-related concepts. The cube is indeed central to ${domain} strategy.`;
      } else if (userMsg.toLowerCase().includes('beginner') || userMsg.toLowerCase().includes('simple')) {
        updatedPlan.focus = `Focus on the absolute essentials for complete beginners. ${plan.focus} Prioritize clarity and simplicity over comprehensiveness.`;
        response = `I've adjusted the focus to prioritize beginner-friendly content. We'll emphasize clarity and the most essential concepts rather than trying to be comprehensive.`;
      } else if (userMsg.toLowerCase().includes('magriel') || userMsg.toLowerCase().includes('intuitive')) {
        updatedPlan.queries = [
          ...plan.queries,
          `What is the Magriel school of ${domain} and how does it approach intuitive play?`
        ];
        updatedPlan.sources = [...plan.sources, "Magriel's Backgammon", 'Intuitive play resources'];
        response = `Great addition! Since your profile emphasizes the Magriel approach, I've added a query about his intuitive methodology and added his work to the source list.`;
      } else {
        updatedPlan.queries = [...plan.queries, userMsg];
        response = `I've added "${userMsg}" as an additional research query. Anything else you'd like to adjust?`;
      }
      
      setPlan(updatedPlan);
      setChat(c => [...c, { role: 'assistant', content: response }]);
    }, 800);
  };

  const executeResearch = () => {
    setView('running');
    setTimeout(() => {
      const recs = MOCK_RECS[currentResearch?.title] || MOCK_RECS['Core Concepts & Definitions'];
      setRecommendations(recs.map(r => ({ ...r, status: 'pending' })));
      setView('review');
    }, 2500);
  };

  const completeResearch = () => {
    const adopted = recommendations.filter(r => r.status === 'adopted');
    if (adopted.length > 0 && currentResearch) {
      setCorpus(prev => ({
        dimensions: prev.dimensions.map(dim =>
          dim.id === currentResearch.dimensionId
            ? { ...dim, items: [...dim.items, ...adopted.map(r => ({ id: r.id, name: r.title }))] }
            : dim
        )
      }));
    }
    setResearchHistory([...researchHistory, { title: currentResearch?.title, adopted: adopted.length }]);
    setView('home');
    setCurrentResearch(null);
    setPlan(null);
    setRecommendations([]);
    setChat([]);
  };

  if (view === 'running') return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <Spinner size={64} />
      <h3 style={{ fontSize: '20px', fontWeight: '600', marginTop: '24px' }}>{currentResearch?.title}</h3>
      <p style={{ color: tokens.colors.textSecondary }}>Searching {plan?.sources?.length || 3} source types...</p>
      <div style={{ maxWidth: '400px', margin: '24px auto 0' }}>
        <ProgressBar value={65} />
      </div>
    </div>
  );

  if (view === 'review') {
    const pending = recommendations.filter(r => r.status === 'pending').length;
    const adopted = recommendations.filter(r => r.status === 'adopted').length;
    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ marginBottom: '24px' }}>
          <Badge variant="accent">Review Findings</Badge>
          <h2 style={{ fontSize: '24px', fontWeight: '600', marginTop: '8px' }}>{currentResearch?.title}</h2>
          <p style={{ color: tokens.colors.textSecondary }}>Found {recommendations.length} items. Choose what to add to your guru's knowledge.</p>
        </div>
        {recommendations.map(rec => (
          <Card key={rec.id} elevated style={{ marginBottom: '12px', opacity: rec.status !== 'pending' ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h4 style={{ fontWeight: '600', margin: 0 }}>{rec.title}</h4>
              <Badge variant={rec.confidence >= 0.9 ? 'success' : 'warning'}>{Math.round(rec.confidence * 100)}%</Badge>
            </div>
            <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '12px' }}>{rec.content}</div>
            {rec.status === 'pending' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button variant="secondary" size="sm" onClick={() => setRecommendations(rs => rs.map(r => r.id === rec.id ? { ...r, status: 'skip' } : r))}>Skip</Button>
                <Button size="sm" onClick={() => setRecommendations(rs => rs.map(r => r.id === rec.id ? { ...r, status: 'adopted' } : r))}>Add to Knowledge</Button>
              </div>
            ) : <Badge variant={rec.status === 'adopted' ? 'success' : 'default'}>{rec.status === 'adopted' ? '✓ Added' : 'Skipped'}</Badge>}
          </Card>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', padding: '16px', background: tokens.colors.bgSubtle, borderRadius: '12px' }}>
          <span>{pending > 0 ? `${pending} remaining to review` : `Adding ${adopted} items to corpus`}</span>
          <Button onClick={completeResearch} disabled={pending > 0}>Complete Research</Button>
        </div>
      </div>
    );
  }

  if (view === 'assistant') return (
    <div style={{ padding: '24px 0' }}>
      <Button variant="ghost" onClick={() => setView('home')} style={{ marginBottom: '24px' }}>← Back</Button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Badge variant="accent">Research Run</Badge>
        <span style={{ fontSize: '15px', fontWeight: '500' }}>{plan?.title}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <Card elevated style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Research Assistant</h3>
          </div>
          <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: '320px', maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {chat.map((m, i) => <ChatBubble key={i} role={m.role}>{m.content}</ChatBubble>)}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatRefinement()}
                placeholder="Refine the plan... (try 'focus on cube decisions')"
                style={{ flex: 1, padding: '10px 14px', borderRadius: '980px', border: `1px solid ${tokens.colors.border}`, outline: 'none', fontSize: '14px' }} />
              <Button size="sm" onClick={handleChatRefinement}>Send</Button>
            </div>
          </div>
        </Card>
        <Card elevated style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Research Plan</h3>
            <Badge variant="default">{domain}</Badge>
          </div>
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            {plan && (
              <>
                <h4 style={{ fontSize: '17px', fontWeight: '600', marginBottom: '16px' }}>{plan.title}</h4>
                
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: tokens.colors.textTertiary, textTransform: 'uppercase', marginBottom: '8px' }}>Research Queries</div>
                  {plan.queries.map((q, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: tokens.colors.bgSubtle, borderRadius: '8px', fontSize: '13px', marginBottom: '8px', lineHeight: '1.4' }}>
                      {q}
                    </div>
                  ))}
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: tokens.colors.textTertiary, textTransform: 'uppercase', marginBottom: '8px' }}>Focus</div>
                  <div style={{ padding: '10px 12px', background: tokens.colors.bgSubtle, borderRadius: '8px', fontSize: '13px', lineHeight: '1.5' }}>
                    {plan.focus}
                  </div>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: tokens.colors.textTertiary, textTransform: 'uppercase', marginBottom: '8px' }}>Sources</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {plan.sources.map((s, i) => (
                      <span key={i} style={{ padding: '4px 10px', background: tokens.colors.bgSubtle, borderRadius: '980px', fontSize: '12px' }}>{s}</span>
                    ))}
                  </div>
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', color: tokens.colors.textTertiary, textTransform: 'uppercase', marginBottom: '8px' }}>Output Format</div>
                  <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{plan.outputFormat}</div>
                </div>
                
                <Button onClick={executeResearch} style={{ width: '100%' }}>Execute Research →</Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>Research & Knowledge</h2>
          <p style={{ color: tokens.colors.textSecondary }}>Build your {domain} guru's teaching expertise</p>
        </div>
        <Button variant="secondary" onClick={() => setShowCorpus(true)}>View Corpus ({totalKnowledge})</Button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        {[
          { value: researchHistory.length, label: 'Research Runs', color: tokens.colors.accent },
          { value: totalKnowledge, label: 'Knowledge Items', color: tokens.colors.success },
          { value: `${coveredDimensions.length}/${corpus.dimensions.length}`, label: 'Dimensions', color: gaps.length > 0 ? tokens.colors.warning : tokens.colors.success },
        ].map(s => (
          <Card key={s.label} style={{ flex: 1, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, textTransform: 'uppercase' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {researchHistory.length === 0 && (
        <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(0,113,227,0.05) 0%, rgba(0,113,227,0.1) 100%)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>💡</span>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>What makes a great teaching guru?</h3>
              <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: 0, lineHeight: '1.6' }}>
                Great teachers don't just know {domain} — they understand how people <em>learn</em> it.
                Build content across foundational concepts, common mistakes, learning progressions, and examples.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Recommended Research</h3>
        {RESEARCH_SUGGESTIONS.filter(s => corpus.dimensions.find(d => d.id === s.dimension)?.items.length === 0).slice(0, 4).map(s => {
          const dim = corpus.dimensions.find(d => d.id === s.dimension);
          return (
            <Card key={s.id} style={{ marginBottom: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span>{dim?.icon}</span>
                    <Badge variant={s.priority === 'high' ? 'error' : 'warning'}>{s.priority.toUpperCase()}</Badge>
                    <span style={{ fontWeight: '500' }}>{dim?.name}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: '8px 0 0' }}>{s.reason}</p>
                </div>
                <Button size="sm" onClick={() => startResearch(s.title, s.dimension)}>Research →</Button>
              </div>
            </Card>
          );
        })}
        {RESEARCH_SUGGESTIONS.filter(s => corpus.dimensions.find(d => d.id === s.dimension)?.items.length === 0).length === 0 && (
          <Card style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
            <p style={{ color: tokens.colors.textSecondary }}>All dimensions covered!</p>
          </Card>
        )}
      </div>

      <Card elevated style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>Custom Research</h3>
        <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, marginBottom: '16px' }}>Research any {domain}-specific topic</p>
        <Button variant="secondary" onClick={() => { 
          setCurrentResearch({ title: 'Custom Research', dimensionId: 'foundations' }); 
          setPlan(null);
          setChat([{ role: 'assistant', content: `What specific aspect of ${domain} would you like to research? I can help you build content for any topic.` }]);
          setView('assistant'); 
        }}>+ Custom Research</Button>
      </Card>

      {researchHistory.length > 0 && (
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>History</h3>
          {researchHistory.map((run, i) => (
            <Card key={i} style={{ marginBottom: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '500' }}>{run.title}</span>
                <Badge variant="success">+{run.adopted}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
        <Button onClick={onProceedToReadiness} disabled={totalKnowledge === 0}>Check Readiness →</Button>
      </div>

      <CorpusExplorer isOpen={showCorpus} onClose={() => setShowCorpus(false)} corpus={corpus}
        onResearch={(dimId) => startResearch(RESEARCH_SUGGESTIONS.find(x => x.dimension === dimId)?.title || 'Research', dimId)} />
    </div>
  );
};

// Readiness Checkpoint - Universal Pedagogical Criteria
const ReadinessCheckpoint = ({ corpus, onBackToResearch, onProceedToArtifacts }) => {
  const coveredDimensions = corpus.dimensions.filter(d => d.items.length > 0);
  const gaps = corpus.dimensions.filter(d => d.items.length === 0);
  const profileScore = 85;
  const knowledgeScore = Math.round((coveredDimensions.length / corpus.dimensions.length) * 100);
  const overallScore = Math.round((profileScore + knowledgeScore) / 2);

  // Priority order for gaps (which ones matter most for a minimum viable guru)
  const priorityOrder = ['foundations', 'mistakes', 'progression', 'examples', 'practice', 'nuance'];
  const sortedGaps = [...gaps].sort((a, b) => priorityOrder.indexOf(a.id) - priorityOrder.indexOf(b.id));
  const criticalGaps = sortedGaps.filter(g => ['foundations', 'mistakes', 'progression'].includes(g.id));
  const niceToHaveGaps = sortedGaps.filter(g => !['foundations', 'mistakes', 'progression'].includes(g.id));

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>Readiness Check</h2>
        <p style={{ color: tokens.colors.textSecondary, maxWidth: '500px', margin: '0 auto' }}>
          Great teaching requires more than domain knowledge. We check your guru against what learning science tells us students need.
        </p>
      </div>

      {/* Overall Score */}
      <Card elevated style={{ textAlign: 'center', marginBottom: '32px', padding: '32px' }}>
        <div style={{ fontSize: '64px', fontWeight: '600', color: overallScore >= 80 ? tokens.colors.success : overallScore >= 50 ? tokens.colors.warning : tokens.colors.error, marginBottom: '8px' }}>
          {overallScore}%
        </div>
        <div style={{ fontSize: '15px', color: tokens.colors.textSecondary }}>Overall Readiness</div>
        <div style={{ maxWidth: '300px', margin: '16px auto 0' }}>
          <ProgressBar value={overallScore} height={8} color={overallScore >= 80 ? tokens.colors.success : overallScore >= 50 ? tokens.colors.warning : tokens.colors.error} />
        </div>
      </Card>

      {/* What Every Guru Needs - Educational Context */}
      <Card style={{ marginBottom: '32px', padding: '20px', background: 'linear-gradient(135deg, rgba(0,113,227,0.05) 0%, rgba(0,113,227,0.02) 100%)', border: `1px solid rgba(0,113,227,0.1)` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🎓</span>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontWeight: '600' }}>What Makes a Great Teacher?</h4>
            <p style={{ margin: 0, fontSize: '14px', color: tokens.colors.textSecondary, lineHeight: '1.6' }}>
              Research shows effective teaching isn't just about knowing your subject—it's about understanding how students learn it wrong, 
              how to scaffold difficulty, and when the rules break down. These universal dimensions apply to any domain.
            </p>
          </div>
        </div>
      </Card>

      {/* What's Strong */}
      {coveredDimensions.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: tokens.colors.success }}>✓</span> What's Strong
          </h3>
          <Card style={{ marginBottom: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>Teaching Profile</div>
                <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>Clear voice, style, and target audience defined</div>
              </div>
              <Badge variant="success">{profileScore}%</Badge>
            </div>
          </Card>
          {coveredDimensions.map(dim => (
            <Card key={dim.id} style={{ marginBottom: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>{dim.icon}</span>
                  <div>
                    <div style={{ fontWeight: '500' }}>{dim.name}</div>
                    <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{dim.items.length} knowledge items</div>
                  </div>
                </div>
                <Badge variant="success">Covered</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Critical Gaps */}
      {criticalGaps.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: tokens.colors.error }}>⚠</span> Critical Gaps
          </h3>
          <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '16px' }}>
            These dimensions are essential for effective teaching. Students will struggle without them.
          </p>
          {criticalGaps.map(dim => {
            const suggestion = RESEARCH_SUGGESTIONS.find(s => s.dimension === dim.id);
            return (
              <Card key={dim.id} style={{ marginBottom: '12px', padding: '16px', background: tokens.colors.errorBg, border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '18px' }}>{dim.icon}</span>
                      <span style={{ fontWeight: '600' }}>{dim.name}</span>
                      <Badge variant="error">Missing</Badge>
                    </div>
                    <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '8px' }}>{dim.description}</div>
                    <div style={{ fontSize: '13px', color: tokens.colors.error, fontStyle: 'italic' }}>
                      Why it matters: {suggestion?.reason}
                    </div>
                  </div>
                  <Button size="sm" onClick={onBackToResearch} style={{ flexShrink: 0, marginLeft: '16px' }}>Research →</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Nice-to-Have Gaps */}
      {niceToHaveGaps.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: tokens.colors.warning }}>○</span> Would Strengthen
          </h3>
          <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, marginBottom: '16px' }}>
            These aren't blockers, but would make your guru more effective.
          </p>
          {niceToHaveGaps.map(dim => {
            const suggestion = RESEARCH_SUGGESTIONS.find(s => s.dimension === dim.id);
            return (
              <Card key={dim.id} style={{ marginBottom: '12px', padding: '16px', background: tokens.colors.warningBg, border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '18px' }}>{dim.icon}</span>
                      <span style={{ fontWeight: '500' }}>{dim.name}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{suggestion?.reason}</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={onBackToResearch} style={{ flexShrink: 0, marginLeft: '16px' }}>Research →</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <Card style={{ marginBottom: '32px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>{gaps.length === 0 ? '🎉' : criticalGaps.length > 0 ? '🤔' : '💡'}</span>
          <div>
            {gaps.length === 0 ? (
              <p style={{ margin: 0 }}><strong>Excellent!</strong> Your guru covers all the pedagogical dimensions that make teaching effective. Ready to create content!</p>
            ) : criticalGaps.length > 0 ? (
              <p style={{ margin: 0 }}><strong>Consider addressing critical gaps first.</strong> Your guru can still proceed, but students may struggle with fundamentals. The generated curriculum and drills will be less effective.</p>
            ) : (
              <p style={{ margin: 0 }}><strong>Looking good!</strong> Core dimensions are covered. The remaining gaps would strengthen your guru but aren't blockers.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="secondary" onClick={onBackToResearch}>← Back to Research</Button>
        <Button onClick={onProceedToArtifacts}>
          {criticalGaps.length > 0 ? 'Proceed Anyway →' : gaps.length > 0 ? 'Proceed →' : 'Create Artifacts →'}
        </Button>
      </div>
    </div>
  );
};

// Drill Viewer
const DrillViewer = ({ onClose }) => {
  const [flyover, setFlyover] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '375px', height: '700px', background: 'linear-gradient(180deg, #2d1f14 0%, #1a1208 100%)', borderRadius: '40px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', zIndex: 10 }}>×</button>
        <div style={{ padding: '48px 20px 12px' }}>
          <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px' }}>Opening Drills</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>Drill 1 of 12</div>
        </div>
        <div style={{ flex: flyover ? '0 0 200px' : '1', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1000px', transition: 'all 0.5s', padding: '20px' }}>
          <div style={{ width: '200px', height: '140px', background: '#1a4d1a', borderRadius: '8px', transform: flyover ? 'rotateX(55deg) scale(0.85)' : 'rotateX(0deg)', transformStyle: 'preserve-3d', transition: 'transform 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '12px' }}>
          {[5, 2].map((v, i) => <div key={i} style={{ width: '36px', height: '36px', background: '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700' }}>{v}</div>)}
        </div>
        {!flyover ? (
          <div style={{ padding: '16px 20px 32px', background: 'linear-gradient(180deg, rgba(231,76,60,0.2), rgba(192,57,43,0.3))', borderRadius: '20px 20px 0 0', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✗</div>
            <div style={{ color: '#e74c3c', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Not quite right</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '16px' }}>Best move: <strong>8/5, 6/5</strong></div>
            <button onClick={() => setFlyover(true)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '15px', fontWeight: '600', padding: '14px 24px', borderRadius: '14px', cursor: 'pointer', width: '100%' }}>Dive Deeper →</button>
          </div>
        ) : (
          <div style={{ flex: 1, padding: '16px 20px 32px', background: 'linear-gradient(180deg, rgba(46,204,113,0.15), rgba(39,174,96,0.25))', borderRadius: '20px 20px 0 0', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><span>💡</span><span style={{ color: '#2ecc71', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>The Golden Anchor</span></div>
            <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Making the 5-Point</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.5', marginBottom: '16px' }}>The 5-point is the most valuable point on your home board. Making it early creates a strong foundation.</p>
            <div style={{ background: 'rgba(46,204,113,0.15)', border: '1px solid rgba(46,204,113,0.25)', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px' }}>
              <span style={{ color: '#2ecc71', fontSize: '11px', fontWeight: '600' }}>💡 When you can make the 5-point, almost always do it.</span>
            </div>
            <button onClick={() => setFlyover(false)} style={{ background: 'linear-gradient(135deg, #e67e22, #d35400)', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '600', padding: '14px 24px', borderRadius: '14px', cursor: 'pointer', width: '100%' }}>Next Drill →</button>
          </div>
        )}
      </div>
    </div>
  );
};

// Guru Chat
const GuruChat = ({ isOpen, onClose }) => {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: 'Hello! What would you like to learn?' }]);
  const [input, setInput] = useState('');
  const send = () => { if (!input.trim()) return; setMsgs([...msgs, { role: 'user', content: input }]); setInput('');
    setTimeout(() => setMsgs(m => [...m, { role: 'assistant', content: "Great question! What's your instinct here first?" }]), 1000); };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Test Your Guru" width="600px">
      <Card elevated style={{ marginBottom: '16px' }}>
        <div style={{ height: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {msgs.map((m, i) => <ChatBubble key={i} role={m.role}>{m.content}</ChatBubble>)}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask..." style={{ flex: 1, padding: '12px 16px', borderRadius: '980px', border: `1px solid ${tokens.colors.border}`, fontSize: '15px', outline: 'none' }} />
          <Button onClick={send}>Send</Button>
        </div>
      </Card>
    </Modal>
  );
};

// Artifacts Phase
const ArtifactsPhase = () => {
  const [viewing, setViewing] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showDrill, setShowDrill] = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  const artifacts = {
    'mental-model': { icon: '🧠', title: 'Mental Model', subtitle: 'Core Framework', sections: [{ name: 'Foundational Principles', items: ['Core concept 1', 'Core concept 2', 'Core concept 3'] }, { name: 'Decision Framework', items: ['When to do X', 'When to do Y'] }] },
    'curriculum': { icon: '📚', title: 'Curriculum', subtitle: 'Learning Path', phases: [{ name: 'Beginner', lessons: 12, duration: '2 weeks' }, { name: 'Intermediate', lessons: 18, duration: '3 weeks' }, { name: 'Advanced', lessons: 10, duration: '2 weeks' }] },
    'drills': { icon: '🎯', title: 'Drills', subtitle: 'Practice Exercises', series: [{ name: 'Fundamentals', drills: 24, difficulty: 'Beginner' }, { name: 'Applied Skills', drills: 32, difficulty: 'Intermediate' }] },
  };

  if (showPublish) return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎓</div>
      <h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '32px' }}>Your Guru is Ready!</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[{ icon: '🔗', title: 'Share Link' }, { icon: '📱', title: 'Mobile App' }, { icon: '🌐', title: 'Embed' }].map(o => (
          <Card key={o.title} elevated style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{o.icon}</div>
            <div style={{ fontWeight: '500' }}>{o.title}</div>
          </Card>
        ))}
      </div>
      <Card style={{ textAlign: 'left', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value="https://guru.app/my-guru" readOnly style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, fontFamily: tokens.fonts.mono }} />
          <Button>Copy</Button>
        </div>
      </Card>
      <Button variant="secondary" onClick={() => setShowPublish(false)}>← Back</Button>
    </div>
  );

  if (viewing) {
    const a = artifacts[viewing];
    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Button variant="ghost" onClick={() => setViewing(null)}>← Back to Artifacts</Button>
          <div style={{ display: 'flex', gap: '8px' }}><Badge variant="success">✓ Generated</Badge><Button variant="secondary" size="sm">Edit</Button></div>
        </div>
        <Card elevated>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '40px' }}>{a.icon}</span>
            <div><h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>{a.subtitle}</h2><p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: 0 }}>{a.title}</p></div>
          </div>
          {viewing === 'mental-model' && a.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>{s.name}</h3>
              {s.items.map((item, j) => <div key={j} style={{ padding: '12px 16px', background: tokens.colors.bgSubtle, borderRadius: '8px', marginBottom: '8px' }}>{item}</div>)}
            </div>
          ))}
          {viewing === 'curriculum' && a.phases.map((p, i) => (
            <div key={i} style={{ padding: '16px', background: tokens.colors.bgSubtle, borderRadius: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontWeight: '500' }}>{p.name}</div><div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{p.lessons} lessons · {p.duration}</div></div>
              <Button variant="ghost" size="sm">Expand →</Button>
            </div>
          ))}
          {viewing === 'drills' && a.series.map((s, i) => (
            <div key={i} style={{ padding: '16px', background: tokens.colors.bgSubtle, borderRadius: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontWeight: '500' }}>{s.name}</div><div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>{s.drills} drills · {s.difficulty}</div></div>
              <Button variant="ghost" size="sm" onClick={() => setShowDrill(true)}>Preview Drill →</Button>
            </div>
          ))}
        </Card>
        {showDrill && <DrillViewer onClose={() => setShowDrill(false)} />}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div><h2 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>Teaching Artifacts</h2><p style={{ color: tokens.colors.textSecondary }}>Create content from your guru's knowledge</p></div>
        <div style={{ display: 'flex', gap: '8px' }}><Button variant="secondary" onClick={() => setShowChat(true)}>Test Guru</Button><Button onClick={() => setShowPublish(true)}>Publish →</Button></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {Object.entries(artifacts).map(([id, a]) => (
          <Card key={id} elevated onClick={() => setViewing(id)} style={{ cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{a.icon}</div>
            <h3 style={{ fontSize: '17px', fontWeight: '600', marginBottom: '4px' }}>{a.title}</h3>
            <p style={{ fontSize: '14px', color: tokens.colors.textSecondary }}>{a.subtitle}</p>
          </Card>
        ))}
      </div>
      <GuruChat isOpen={showChat} onClose={() => setShowChat(false)} />
    </div>
  );
};

// Main App
const GuruBuilder = () => {
  const [screen, setScreen] = useState('welcome');
  const [profile, setProfile] = useState(null);
  const [corpus, setCorpus] = useState(INITIAL_CORPUS);

  const phases = ['Profile', 'Knowledge', 'Create'];
  const idx = { profile: 0, research: 1, readiness: 1, artifacts: 2 }[screen] ?? -1;

  if (screen === 'welcome') return <div style={{ minHeight: '100vh', background: tokens.colors.bg }}><WelcomeScreen onContinue={() => setScreen('profile')} onViewExamples={() => setScreen('examples')} /></div>;
  if (screen === 'examples') return <div style={{ minHeight: '100vh', background: tokens.colors.bg }}><div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px' }}><ExampleGallery onClose={() => setScreen('welcome')} onUseTemplate={g => { setProfile({ ...MOCK_PROFILE, domain: g.name }); setScreen('profile'); }} /></div></div>;

  return (
    <div style={{ minHeight: '100vh', background: tokens.colors.bg }}>
      <header style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}`, background: 'rgba(250,250,250,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: '600', cursor: 'pointer' }} onClick={() => setScreen('welcome')}>Guru Builder</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {phases.map((p, i) => (
              <React.Fragment key={p}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '500',
                    background: i < idx ? tokens.colors.accent : i === idx ? tokens.colors.text : 'transparent',
                    color: i <= idx ? '#FFF' : tokens.colors.textSecondary,
                    border: i > idx ? `1px solid ${tokens.colors.border}` : 'none' }}>{i < idx ? '✓' : i + 1}</div>
                  <span style={{ fontSize: '13px', fontWeight: i === idx ? '500' : '400', color: i === idx ? tokens.colors.text : tokens.colors.textSecondary }}>{p}</span>
                </div>
                {i < phases.length - 1 && <div style={{ width: '24px', height: '1px', background: i < idx ? tokens.colors.accent : tokens.colors.border }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px', paddingBottom: '100px' }}>
        {screen === 'profile' && <ProfileCreation onComplete={() => { if (!profile) setProfile(MOCK_PROFILE); setScreen('research'); }} initialProfile={profile} />}
        {screen === 'research' && <ResearchPhase corpus={corpus} setCorpus={setCorpus} onProceedToReadiness={() => setScreen('readiness')} profile={profile || MOCK_PROFILE} />}
        {screen === 'readiness' && <ReadinessCheckpoint corpus={corpus} onBackToResearch={() => setScreen('research')} onProceedToArtifacts={() => setScreen('artifacts')} />}
        {screen === 'artifacts' && <ArtifactsPhase />}
      </main>
      <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'rgba(250,250,250,0.95)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${tokens.colors.borderSubtle}` }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: tokens.colors.textTertiary, alignSelf: 'center', marginRight: '8px' }}>Jump:</span>
          {['welcome', 'examples', 'profile', 'research', 'readiness', 'artifacts'].map(s => (
            <Button key={s} variant={screen === s ? 'primary' : 'secondary'} size="sm" onClick={() => setScreen(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</Button>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default GuruBuilder;
