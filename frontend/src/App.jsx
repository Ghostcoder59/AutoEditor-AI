import React, { useState, useRef } from 'react';
import { motion as Motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  UploadCloud,
  CheckCircle,
  Check,
  AlertCircle,
  Download,
  RefreshCw,
  Scissors,
  Gauge,
  Clock3,
  FileVideo,
  LogOut,
  Home,
  Film,
  User,
  Sun,
  Moon,
  Mail,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TOKEN_KEY = 'autoeditor_token';
const THEME_KEY = 'autoeditor_theme';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
};

const formatSecondsLabel = (seconds) => {
  const safeValue = Number(seconds);
  if (!Number.isFinite(safeValue) || safeValue < 0) return '0:00';
  const mins = Math.floor(safeValue / 60);
  const secs = Math.floor(safeValue % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatScorePct = (score) => `${Math.round(Math.max(0, Math.min(1, Number(score) || 0)) * 100)}%`;

const DEFAULT_PLAN_CATALOG = {
  trial_days: 60,
  plans: {
    free: {
      price_usd: 0,
      features: ['basic_processing', 'standard_queue'],
    },
    plus: {
      price_usd: 4.99,
      features: ['hd_export', 'faster_queue', 'premium_models'],
    },
    pro: {
      price_usd: 11.99,
      features: ['4k_export', 'priority_queue', 'all_premium_models', 'batch_jobs'],
    },
  },
};

const PLAN_COPY = {
  free: {
    title: 'Free',
    subtitle: 'Great for regular creators',
    reasons: ['Core highlight generation', 'Standard queue speed'],
  },
  plus: {
    title: 'Plus',
    subtitle: 'Best value for active users',
    reasons: ['Faster processing queue', 'Premium AI quality + HD exports'],
  },
  pro: {
    title: 'Pro',
    subtitle: 'For power creators and teams',
    reasons: ['Priority queue for fastest turnaround', 'All advanced models + batch workflows + YouTube publish'],
  },
};

function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'dark');
  const [activeTab, setActiveTab] = useState('home');

  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authLogin, setAuthLogin] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [status, setStatus] = useState('IDLE'); // IDLE, UPLOADING, PROCESSING, SUCCESS, ERROR
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [jobMeta, setJobMeta] = useState({ stage: '', processing_seconds: null, file_size_mb: null });
  const [videoSummary, setVideoSummary] = useState('');
  const [summaryMeta, setSummaryMeta] = useState(null);
  const [liveWaveform, setLiveWaveform] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [exportingYouTube, setExportingYouTube] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const [exportFormat, setExportFormat] = useState('16:9');
  const [videoFilter, setVideoFilter] = useState('none');
  const [youtubeUrl, setYoutubeUrl] = useState(null);
  const [showExportForm, setShowExportForm] = useState(false);
  const [exportTitle, setExportTitle] = useState('');
  const [exportDesc, setExportDesc] = useState('');
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const orbX = useSpring(pointerX, { stiffness: 45, damping: 22, mass: 1.1 });
  const orbY = useSpring(pointerY, { stiffness: 45, damping: 22, mass: 1.1 });
  const gridX = useTransform(pointerX, (v) => v * 0.35);
  const gridY = useTransform(pointerY, (v) => v * 0.35);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  React.useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Invalid session');
        const data = await response.json();
        setUser(data);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    };

    loadUser();
  }, [token]);

  React.useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setShowCookieBanner(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptCookies = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setShowCookieBanner(false);
  };

  const downloadTextFile = (content, filename, mimeType = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportVideoReport = () => {
    if (!summaryMeta) {
      setAuthError('No report is available yet. Process a video first.');
      return;
    }

    const reportLines = [
      'AutoEditor Pro Video Brief',
      `Summary: ${videoSummary || 'No summary available.'}`,
      `Subject: ${summaryMeta.subject_brief || 'Not detected'}`,
      `Topics: ${Array.isArray(summaryMeta.topic_keywords) && summaryMeta.topic_keywords.length ? summaryMeta.topic_keywords.join(', ') : 'None detected'}`,
      `Mode: ${summaryMeta.summary_mode || 'unknown'}`,
      `Duration: ${summaryMeta.video_duration_seconds ?? 'unknown'}s`,
      `Detected segments: ${summaryMeta.detected_segments ?? 0}`,
      `Merged clusters: ${summaryMeta.merged_clusters ?? 0}`,
      '',
      'Timestamped Moments',
      ...(Array.isArray(summaryMeta.best_moments) && summaryMeta.best_moments.length
        ? summaryMeta.best_moments.map((moment) => `${moment.display_time} | ${moment.label}`)
        : ['No moment labels available.']),
      '',
      'Export ready note: review the clip sequence before publishing.',
    ];

    downloadTextFile(reportLines.join('\n'), `autoeditor-brief-${Date.now()}.txt`);
    setAuthMessage('Video brief report downloaded.');
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const mode = params.get('mode');
    const tokenFromUrl = params.get('token');
    const authStatus = params.get('auth');

    if (tab) setActiveTab(tab);
    if (mode) setAuthMode(mode);
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setAuthMode('reset');
      setActiveTab('account');
    }

    if (authStatus === 'youtube_success' && token) {
      setAuthMessage('YouTube account connected successfully!');
      // Refresh user to get youtube_connected: true
      const loadUser = async () => {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      };
      loadUser();
      
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.toString());
    }
  }, [token]);

  const authHeaders = () => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  const clearPolling = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const resetEditorState = () => {
    clearPolling();
    setStatus('IDLE');
    setErrorMsg('');
    setDownloadUrl(null);
    setVideoUrl('');
    setMessage('');
    setSelectedFile(null);
    setProgress(0);
    setJobMeta({ stage: '', processing_seconds: null, file_size_mb: null });
    setVideoSummary('');
    setSummaryMeta(null);
    setLiveWaveform([]);
    setAnalysisProgress(null);
    setUrlInput('');
    setYoutubeUrl(null);
    setExportingYouTube(false);
    setShowExportForm(false);
    setExportTitle('');
    setExportDesc('');
  };

  const handleLogout = () => {
    clearPolling();
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    resetEditorState();
  };

  const handleTestEmail = async () => {
    if (!user || authLoading) return;
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Test email failed');
      setAuthMessage(data.message);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);

    try {
      let endpoint = '/auth/login';
      let body = { login: authLogin, password: authPassword };

      if (authMode === 'register') {
        endpoint = '/auth/register';
        body = { username: authUsername, email: authEmail, password: authPassword };
      } else if (authMode === 'forgot') {
        endpoint = '/auth/forgot-password';
        body = { login: authLogin };
      } else if (authMode === 'reset') {
        endpoint = '/auth/reset-password';
        body = { token: resetToken, password: authPassword };
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (authMode === 'login' || authMode === 'register') {
        localStorage.setItem(TOKEN_KEY, data.access_token);
        setToken(data.access_token);
        setUser(data.user);
        setActiveTab('editor');
      } else if (authMode === 'forgot') {
        setAuthMessage('If your account exists, a password reset message has been sent.');
      } else if (authMode === 'reset') {
        setAuthMessage('Password reset complete. You can now sign in.');
        setAuthMode('login');
        setAuthPassword('');
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setStatus('ERROR');
      setErrorMsg('Please select a valid video file.');
      return;
    }

    setSelectedFile({ name: file.name, size: file.size });
    setStatus('UPLOADING');
    setProgress(15);
    setMessage('Uploading and validating your video...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('use_ai', useAi);
    formData.append('export_format', exportFormat);
    formData.append('video_filter', videoFilter);

    try {
      const response = await fetch(`${API_BASE_URL}/process?use_ai=${useAi}&export_format=${exportFormat}&video_filter=${videoFilter}`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to start processing video');

      if (!data.job_id) {
        setStatus('ERROR');
        setErrorMsg('Invalid response from server.');
        return;
      }

      setStatus('PROCESSING');
      setProgress(35);
      setMessage(data.message || 'Upload complete. Starting analysis...');
      checkStatus(data.job_id);
    } catch (error) {
      setStatus('ERROR');
      setErrorMsg(error.message || 'An unexpected error occurred. Is the backend running?');
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setStatus('PROCESSING');
    setProgress(10);
    setMessage('Connecting to URL...');

    try {
      const response = await fetch(`${API_BASE_URL}/process-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ 
          url: urlInput, 
          use_ai: useAi, 
          export_format: exportFormat,
          video_filter: videoFilter
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to start URL processing');

      setStatus('PROCESSING');
      setProgress(25);
      setMessage(data.message || 'Download started...');
      checkStatus(data.job_id);
    } catch (error) {
      setStatus('ERROR');
      setErrorMsg(error.message || 'Could not process URL.');
    }
  };

  const handleYouTubeExport = async (e) => {
    e.preventDefault();
    if (!token || !jobMeta.job_id_internal) return; // We need to store jobId internally or from status

    setExportingYouTube(true);
    setAuthError('');

    try {
      const response = await fetch(`${API_BASE_URL}/export/youtube`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          job_id: jobMeta.job_id_internal,
          title: exportTitle,
          description: exportDesc,
          export_format: exportFormat
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Export failed');

      setYoutubeUrl(data.youtube_url);
      setAuthMessage(data.message);
      setShowExportForm(false);
    } catch (err) {
      setAuthError(err.message || 'Export failed');
    } finally {
      setExportingYouTube(false);
    }
  };

  const connectYouTube = async () => {
    setAuthError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/youtube/login`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to start YouTube connection');
      
      // Open in a popup so we don't lose the video export results in the main tab
      const width = 600;
      const height = 750;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        data.auth_url, 
        'youtubeAuthPopup', 
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
      );
      
      // Start polling user status to update UI once connected
      const checkInterval = setInterval(async () => {
        try {
          // If we left the editor or status is no longer SUCCESS, stop polling
          if (activeTab !== 'account' && activeTab !== 'editor') {
            clearInterval(checkInterval);
            return;
          }

          const uResp = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
          if (uResp.ok) {
            const uData = await uResp.json();
            if (uData.youtube_connected) {
              setUser(uData);
              clearInterval(checkInterval);
            }
          }
        } catch (e) {
          console.error("Error checking connection status", e);
        }
      }, 3000);
      
      // Cleanup interval after 5 minutes just in case
      setTimeout(() => clearInterval(checkInterval), 300000);
      
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleDisconnectYoutube = async () => {
    if (!window.confirm("Are you sure you want to disconnect your YouTube account? You will need to reconnect to publish videos.")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/youtube/disconnect`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (response.ok) {
        const uResp = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
        const uData = await uResp.json();
        setUser(uData);
        setAuthMessage("YouTube disconnected successfully.");
      } else {
        throw new Error("Failed to disconnect.");
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const checkStatus = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/status/${jobId}`, {
        headers: {
          ...authHeaders(),
        },
      });
      
      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch {}
        console.error(`[Status Check] Backend error: ${errorDetail}`);
        throw new Error(errorDetail);
      }

      const data = await response.json();
      setJobMeta({
        stage: data.stage || '',
        processing_seconds: data.processing_seconds || null,
        file_size_mb: data.file_size_mb || null,
        job_id_internal: jobId,
      });
      setVideoSummary(data.summary || '');
      setSummaryMeta(data.summary_data || null);
      setLiveWaveform(Array.isArray(data.live_audio_waveform) ? data.live_audio_waveform : []);
      setAnalysisProgress(typeof data.analysis_progress_pct === 'number' ? data.analysis_progress_pct : null);

      if (data.status === 'success') {
        clearPolling();
        setStatus('SUCCESS');
        setProgress(100);
        setMessage(data.message);
        setDownloadUrl(`${API_BASE_URL}${data.download_url}`);
        setVideoUrl(`${API_BASE_URL}${data.download_url}`);
      } else if (data.status === 'error') {
        clearPolling();
        setStatus('ERROR');
        setErrorMsg(data.error_detail || data.message || 'An error occurred during processing.');
      } else {
        setMessage(data.message || 'Analyzing audio & video...');
        if (typeof data.analysis_progress_pct === 'number') {
          const pct = Math.max(0, Math.min(95, Math.round(data.analysis_progress_pct)));
          setProgress((prev) => Math.max(prev, pct));
        } else {
          setProgress((prev) => Math.min(prev + 8, 95));
        }
        pollingRef.current = setTimeout(() => checkStatus(jobId), 3000);
      }
    } catch (error) {
      clearPolling();
      setStatus('ERROR');
      const errorMsg = error?.message || 'Network error or backend unreachable';
      console.error(`[Status Check] Error: ${errorMsg}`);
      setErrorMsg(`Error: ${errorMsg}`);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect({ target: { files: e.dataTransfer.files } });
    }
  };

  const renderAuthCard = () => (
    <div className="auth-shell">
      <div className="auth-head">
        <h2>
          {authMode === 'register' && 'Create Your Account'}
          {authMode === 'login' && 'Welcome Back'}
          {authMode === 'forgot' && 'Forgot Password'}
          {authMode === 'reset' && 'Reset Password'}
        </h2>
        <p>
          {authMode === 'login' && 'Sign in with your username or email to process long videos.'}
          {authMode === 'register' && 'Username is required for account creation.'}
          {authMode === 'forgot' && 'Enter your email or username to receive a reset message.'}
          {authMode === 'reset' && 'Enter your reset token and choose a new password.'}
        </p>
      </div>

      <form className="auth-form" onSubmit={handleAuth}>
        {authMode === 'register' && (
          <>
            <label>Username</label>
            <input
              type="text"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              placeholder="your_username"
              minLength={3}
              required
            />

            <label>Email</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </>
        )}

        {(authMode === 'login' || authMode === 'forgot') && (
          <>
            <label>Email or Username</label>
            <input
              type="text"
              value={authLogin}
              onChange={(e) => setAuthLogin(e.target.value)}
              placeholder="you@example.com or your_username"
              required
            />
          </>
        )}

        {authMode === 'reset' && (
          <>
            <label>Reset Token</label>
            <input
              type="text"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Paste reset token"
              required
            />
          </>
        )}

        {authMode !== 'forgot' && (
          <>
            <label>Password</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </>
        )}

        {authError && <p className="auth-error">{authError}</p>}
        {authMessage && <p className="auth-ok">{authMessage}</p>}

        <button className="btn" type="submit" disabled={authLoading}>
          {authLoading ? 'Please wait...' : 'Continue'}
        </button>
      </form>

      <p className="auth-switch">
        <button type="button" className="link-btn" onClick={() => { setAuthMode('login'); setAuthError(''); }}>
          Login
        </button>
        <button type="button" className="link-btn" onClick={() => { setAuthMode('register'); setAuthError(''); }}>
          Register
        </button>
        <button type="button" className="link-btn" onClick={() => { setAuthMode('forgot'); setAuthError(''); }}>
          Forgot Password
        </button>
      </p>
    </div>
  );

  const renderEditor = () => {
    if (!token || !user) return renderAuthCard();

    if (status === 'IDLE') {
      return (
        <>
          <div className="user-bar">
            <div className="user-chip">
              <span>@{user.username}</span>
              <span>{user.email}</span>
            </div>
          </div>

          <div className="ai-suite-card" style={{ 
              marginBottom: '1.5rem', 
              padding: '1.5rem', 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)', 
              borderRadius: '20px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ 
                    padding: '0.5rem', 
                    background: 'var(--primary)', 
                    borderRadius: '12px',
                    display: 'flex'
                  }}>
                    <Gauge size={20} color="white" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>AI Pro Suite</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Computer Vision + NLP Intelligence</p>
                  </div>
                </div>
                <button 
                  className={`btn mini ${useAi ? '' : 'secondary'}`}
                  onClick={() => setUseAi(!useAi)}
                  style={{ 
                    borderRadius: '12px',
                    padding: '0.5rem 1rem',
                    background: useAi ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    border: useAi ? 'none' : '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {useAi ? '✅ Suite Enabled' : 'Enable Suite'}
                </button>
              </div>

              {useAi && (
                <Motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="insight-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Film size={16} style={{ color: '#60a5fa' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>YOLOv8 Action Tracking</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Centering players & ball</span>
                      </div>
                    </div>
                    <div className="insight-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Scissors size={16} style={{ color: '#c084fc' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Whisper Commentary</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Transcribing excitement</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Export Format:</span>
                      <select 
                        className="input-field" 
                        value={exportFormat} 
                        onChange={(e) => setExportFormat(e.target.value)}
                        style={{ 
                          width: 'auto', 
                          marginBottom: 0, 
                          background: 'transparent', 
                          border: 'none', 
                          fontSize: '0.9rem',
                          color: 'var(--primary)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="16:9">Horizontal (16:9)</option>
                        <option value="9:16">Vertical Shorts (9:16)</option>
                      </select>
                      {exportFormat === '9:16' && (
                        <span style={{ fontSize: '0.7rem', background: '#ec4899', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase' }}>Smart Crop</span>
                      )}
                    </div>
                    
                    <div className="filter-scroll" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {[
                        { id: 'none', label: 'Original', icon: '✨' },
                        { id: 'vibrant', label: 'Vibrant', icon: '🌈' },
                        { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
                        { id: 'esports_glow', label: 'Glow', icon: '🔥' },
                        { id: 'bw', label: 'Dramatic', icon: '📽️' }
                      ].map(f => (
                        <button
                          key={f.id}
                          className={`filter-chip ${videoFilter === f.id ? 'active' : ''}`}
                          onClick={() => setVideoFilter(f.id)}
                        >
                          <span style={{ fontSize: '1rem' }}>{f.icon}</span>
                          <span style={{ fontSize: '0.75rem' }}>{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Motion.div>
              )}
            </div>

          <div
            className="dropzone"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="dropzone-icon" />
            <p>Drop your long-form footage here</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>or click to browse</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="video/*"
              style={{ display: 'none' }}
            />
          </div>
          <div className="insight-grid">
            <div className="insight-card"><Gauge size={18} /> Random Forest audio classification</div>
            <div className="insight-card"><Clock3 size={18} /> Async processing with status polling</div>
            <div className="insight-card"><FileVideo size={18} /> Automatic highlight reel generation</div>
          </div>

          <div className="url-processor">
            <div className="divider"><span>OR</span></div>
            <form onSubmit={handleUrlSubmit} className="url-form">
              <input
                type="url"
                placeholder="Paste YouTube or Stream URL (https://...)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                required
              />
              <button type="submit" className="btn">Process URL</button>
            </form>
          </div>
        </>
      );
    }

    if (status === 'UPLOADING' || status === 'PROCESSING') {
      const waveformSamples = (Array.isArray(liveWaveform) ? liveWaveform : [])
        .slice(-72)
        .map((value) => Math.max(0, Math.min(1, Number(value) || 0)));

      return (
        <div className="loading-wrapper" style={{ animation: 'fadeIn 0.5s ease' }}>
          <div className="spinner"></div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{message || 'Processing request...'}</h3>

          {selectedFile && (
            <div className="file-meta">
              <span>{selectedFile.name}</span>
              <span>{formatBytes(selectedFile.size)}</span>
            </div>
          )}

          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>{progress}% complete</p>
          {typeof analysisProgress === 'number' && (
            <p style={{ color: 'var(--text-muted)' }}>Analysis progress: {Math.max(0, Math.min(100, Math.round(analysisProgress)))}%</p>
          )}
          {jobMeta.stage && <p style={{ color: 'var(--text-muted)' }}>Stage: {jobMeta.stage}</p>}
          {waveformSamples.length > 0 && (
            <div className="live-wave-card">
              <div className="live-wave-head">
                <span>Live audio activity</span>
                <span>{waveformSamples.length} samples</span>
              </div>
              <div className="live-wave-bars" aria-label="Live waveform preview">
                {waveformSamples.map((sample, idx) => (
                  <span
                    key={`wave-${idx}`}
                    className="live-wave-bar"
                    style={{ height: `${10 + sample * 46}px` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (status === 'SUCCESS') {
      return (
        <div className="result-section">
          <div className="status-badge">
            <CheckCircle size={20} />
            {message}
          </div>
          {videoSummary && (
            <div className="summary-panel">
              <h3>Video Brief</h3>
              {summaryMeta?.subject_brief && (
                <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{summaryMeta.subject_brief}</p>
              )}
              <p>{videoSummary}</p>
              {summaryMeta && (
                <div className="summary-meta">
                  {summaryMeta.topic_keywords?.length ? <span>Topics: {summaryMeta.topic_keywords.join(', ')}</span> : null}
                  <span>{summaryMeta.video_duration_seconds}s analyzed</span>
                  <span>{summaryMeta.detected_segments} detected segments</span>
                  <span>{summaryMeta.merged_clusters} highlight clusters</span>
                  {summaryMeta.summary_mode ? <span>Mode: {summaryMeta.summary_mode}</span> : null}
                </div>
              )}
              {Array.isArray(summaryMeta?.best_moments) && summaryMeta.best_moments.length ? (
                <div className="summary-meta" style={{ marginTop: '0.9rem', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
                  {summaryMeta.best_moments.map((moment) => (
                    <span key={`${moment.start}-${moment.end}`}>{moment.display_time} - {moment.label}</span>
                  ))}
                </div>
              ) : null}
              {Array.isArray(summaryMeta?.score_breakdown) && summaryMeta.score_breakdown.length ? (
                <div className="score-breakdown-wrap">
                  <h4>Highlight score breakdown</h4>
                  <div className="score-breakdown-grid">
                    {summaryMeta.score_breakdown.map((segment, idx) => {
                      const timeLabel = segment.display_time
                        || `${formatSecondsLabel(segment.start)}-${formatSecondsLabel(segment.end)}`;
                      return (
                        <div className="score-card" key={`${segment.start}-${segment.end}-${idx}`}>
                          <div className="score-card-head">
                            <strong>{timeLabel}</strong>
                            <span>Final: {formatScorePct(segment.final_score)}</span>
                          </div>
                          <div className="score-metrics">
                            <span>Audio {formatScorePct(segment.audio_score)}</span>
                            <span>Vision {formatScorePct(segment.vision_score)}</span>
                            <span>Transcript {formatScorePct(segment.transcript_score)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <div className={`video-player ${exportFormat === '9:16' ? 'is-shorts' : ''}`}>
            <video controls autoPlay src={videoUrl} />
          </div>
          <div className="stats-row">
            {jobMeta.processing_seconds && <div className="stat-pill">Processed in {jobMeta.processing_seconds}s</div>}
            {jobMeta.file_size_mb && <div className="stat-pill">Input size {jobMeta.file_size_mb} MB</div>}
          </div>
          <div className="controls">
            <button className="btn btn-download" onClick={() => window.open(downloadUrl, '_blank')}>
              <Download size={20} />
              Download Highlights
            </button>
            <button className="btn secondary" onClick={exportVideoReport} disabled={!summaryMeta}>
              <Download size={20} />
              Download Brief Report
            </button>
            <button 
              className="btn secondary" 
              onClick={() => {
                const canPublishToYoutube = user?.effective_plan === 'trial' || user?.effective_plan === 'pro';
                if (!canPublishToYoutube) {
                  setAuthError('YouTube publishing is available on Pro plan only (or during full trial).');
                  setActiveTab('account');
                  return;
                }
                if (!user.youtube_connected) {
                  setAuthError('Please connect your YouTube account in the Account tab first.');
                  setActiveTab('account');
                  return;
                }
                setShowExportForm(true);
              }}
            >
              <Film size={20} />
              {(user?.effective_plan === 'trial' || user?.effective_plan === 'pro')
                ? (user.youtube_connected ? 'Publish to YouTube' : 'Connect YouTube to Publish')
                : 'Pro Required for YouTube Publish'}
            </button>
            <button className="btn" onClick={resetEditorState}>
              <RefreshCw size={20} />
              Process Another
            </button>
          </div>

          {showExportForm && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0 }}>Publish to YouTube</h3>
                  <div className="status-badge" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                    {exportFormat === '9:16' ? 'Format: YouTube Short' : 'Format: Standard Video'}
                  </div>
                </div>
                <form onSubmit={handleYouTubeExport}>
                  <label>Title</label>
                  <input
                    type="text"
                    value={exportTitle}
                    onChange={(e) => setExportTitle(e.target.value)}
                    placeholder="Amazing Highlights!"
                    required
                  />
                  <label>Description</label>
                  <textarea
                    value={exportDesc}
                    onChange={(e) => setExportDesc(e.target.value)}
                    placeholder="Check out these AI-detected highlights..."
                  />
                  {authError && (
                    <div className="status-badge error" style={{ margin: '1rem 0', padding: '0.8rem', fontSize: '0.85rem' }}>
                      <AlertCircle size={14} /> {authError}
                    </div>
                  )}
                  <div className="modal-actions">
                    <button type="button" className="btn ghost" onClick={() => setShowExportForm(false)}>Cancel</button>
                    <button type="submit" className="btn" disabled={exportingYouTube}>
                      {exportingYouTube ? 'Publishing...' : 'Confirm Publish'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {youtubeUrl && (
            <div className="youtube-success" style={{ padding: '1.5rem', marginTop: '1.5rem', border: '1px solid #10b981', background: 'rgba(16,185,129,0.05)' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: 600 }}>
                <CheckCircle size={20} /> Video is Live on YouTube!
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>
                It takes a few minutes for YouTube to process the HD quality.
              </p>
              <a href={youtubeUrl} className="btn mini" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                View on YouTube
              </a>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="result-section" style={{ alignItems: 'center' }}>
        <div className="status-badge error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={24} />
          Analysis Failed
        </div>
        {videoSummary && (
          <div className="summary-panel">
            <h3>Video Summary</h3>
            <p>{videoSummary}</p>
          </div>
        )}
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem' }}>{errorMsg}</p>
        <button className="btn" onClick={resetEditorState}>
          <RefreshCw size={20} />
          Try Again
        </button>
      </div>
    );
  };

  const renderHome = () => (
    <div className="home-page">
      <div className="hero-split">
        <Motion.div
          className="home-hero"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="hero-kicker">AI Video Ops Suite</p>
          <h2>Turn long raw footage into high-signal highlight reels</h2>
          <p>
            Built for long videos, fast review cycles, and recruiter-grade product polish.
          </p>
          <div className="hero-stats">
            <Motion.div className="stat-chip" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}>
              Up to 4K input
            </Motion.div>
            <Motion.div className="stat-chip" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut', delay: 0.35 }}>
              Long-form ready
            </Motion.div>
            <Motion.div className="stat-chip" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut', delay: 0.7 }}>
              Secure auth + export
            </Motion.div>
          </div>
          <Motion.button
            className="btn hero-cta"
            onClick={() => setActiveTab('editor')}
            whileHover={{ scale: 1.03 }}
            animate={{ boxShadow: ['0 6px 18px rgba(37,99,235,0.25)', '0 10px 30px rgba(37,99,235,0.45)', '0 6px 18px rgba(37,99,235,0.25)'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Film size={18} /> Open Editor
          </Motion.button>
        </Motion.div>

        <Motion.div
          className="hero-preview"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
        >
          <div className="mock-player">
            <div className="mock-head">
              <span></span><span></span><span></span>
            </div>
            <div className="mock-screen">
              <Motion.div className="pulse-ring" animate={{ scale: [0.95, 1.07, 0.95], opacity: [0.45, 0.72, 0.45] }} transition={{ duration: 2.4, repeat: Infinity }} />
              <p>Live Highlight Detection</p>
            </div>
            <div className="mock-timeline">
              <Motion.div className="mock-progress" animate={{ width: ['12%', '82%', '24%'] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
            </div>
          </div>
        </Motion.div>
      </div>

      <div className="home-grid">
        <Motion.div className="home-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 }}>
          <h2>Long Video Highlight Engine</h2>
          <p>
            Upload full-length videos, detect crowd excitement moments, and automatically export a concise highlight reel.
          </p>
        </Motion.div>

        <Motion.div className="home-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }}>
          <h3>How It Works</h3>
          <ul>
            <li>Upload any video length</li>
            <li>AI analyzes cheering intensity in audio</li>
            <li>Best moments are clipped and stitched</li>
          </ul>
        </Motion.div>

        <Motion.div className="home-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.18 }}>
          <h3>Fast Workflow</h3>
          <p>Login, process, preview, and export in one streamlined path.</p>
        </Motion.div>
      </div>

      <div className="home-sections">
        <Motion.section className="home-section" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.55 }}>
          <h3>Built for Real Footage, Not Demo Clips</h3>
          <p>
            AutoEditor Pro is optimized for long recordings where manual trimming is slow and repetitive. Keep what matters, skip dead time.
          </p>
        </Motion.section>

        <Motion.section className="home-section" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.55, delay: 0.08 }}>
          <h3>Production-Minded UX</h3>
          <p>
            Secure auth, export controls, and explicit result disclosure make it deployment-ready instead of just notebook-ready.
          </p>
        </Motion.section>
      </div>
    </div>
  );

  const renderAccount = () => {
    if (!token || !user) return renderAuthCard();
    return (
      <div className="account-shell">
        <div className="user-chip large">
          <span>@{user.username}</span>
          <span>{user.email}</span>
        </div>
        <div className="topup-buttons">
          {!user.youtube_connected ? (
            <button className="btn mini secondary" onClick={connectYouTube}>
              <Film size={16} /> Connect YouTube
            </button>
          ) : (
            <>
              <div className="status-badge" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
                <CheckCircle size={14} /> YouTube Connected
              </div>
              <button className="btn mini ghost" onClick={handleDisconnectYoutube} style={{ color: 'var(--error)' }}>
                Disconnect
              </button>
            </>
          )}
          <button className="btn mini ghost" onClick={handleTestEmail} disabled={authLoading}>
            <Mail size={16} /> {authLoading ? 'Sending...' : 'Test Email'}
          </button>
          <button className="btn mini danger" onClick={handleLogout}><LogOut size={16} /> Logout</button>
        </div>
      </div>
    );
  };

  const renderActiveTab = () => {
    if (activeTab === 'home') return renderHome();
    if (activeTab === 'editor') return renderEditor();
    return renderAccount();
  };

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'editor', label: 'Editor', icon: Film },
    { id: 'account', label: 'Account', icon: User },
  ];

  const pageEnter = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
  };

  const contentTransition = {
    initial: { opacity: 0, y: 14, scale: 0.995 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
    exit: { opacity: 0, y: -8, scale: 0.995, transition: { duration: 0.22, ease: 'easeIn' } },
  };

  return (
    <>
      <Motion.div className="bg-grid" style={{ x: gridX, y: gridY }}></Motion.div>
      <div className="bg-noise"></div>
      <Motion.div className="ambient-orbs" aria-hidden="true" style={{ x: orbX, y: orbY }}>
        <Motion.span
          className="orb orb-a"
          animate={{ x: [0, 26, -14, 0], y: [0, -18, 14, 0], scale: [1, 1.08, 0.98, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        ></Motion.span>
        <Motion.span
          className="orb orb-b"
          animate={{ x: [0, -20, 12, 0], y: [0, 16, -10, 0], scale: [1, 0.96, 1.07, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        ></Motion.span>
        <Motion.span
          className="orb orb-c"
          animate={{ x: [0, 18, -12, 0], y: [0, -24, 12, 0], scale: [1, 1.04, 0.95, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        ></Motion.span>
      </Motion.div>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <Motion.main
        className="app-container"
        variants={pageEnter}
        initial="hidden"
        animate="show"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width - 0.5) * 28;
          const y = ((e.clientY - rect.top) / rect.height - 0.5) * 24;
          pointerX.set(x);
          pointerY.set(y);
        }}
        onMouseLeave={() => {
          pointerX.set(0);
          pointerY.set(0);
        }}
      >
        <Motion.div className="header-row" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div className="header">
            <h1>
              Auto<span style={{ color: 'var(--text-main)' }}>Editor Pro</span>
            </h1>
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Scissors size={20} /> AI highlight generation for long videos
            </p>
          </div>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </Motion.div>

        <Motion.div className="tabs-row" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Motion.button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon size={16} /> {tab.label}
              </Motion.button>
            );
          })}
        </Motion.div>

        {authError && (
          <div className="status-badge error" style={{ margin: '0 auto' }}>
            <AlertCircle size={18} /> {authError}
          </div>
        )}
        {authMessage && (
          <div className="status-badge" style={{ margin: '0 auto' }}>
            <KeyRound size={18} /> {authMessage}
          </div>
        )}

        <AnimatePresence mode="wait">
          <Motion.div
            className="tab-content"
            key={`${activeTab}-${status}`}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={contentTransition}
          >
            {renderActiveTab()}
          </Motion.div>
        </AnimatePresence>

        <footer className="app-footer">
          Results Notice: AutoEditor Pro uses automated signal analysis to identify likely highlight moments. Output quality can vary by crowd noise,
          commentary mix, and recording conditions, so please review and verify edits before publishing or sharing.
        </footer>
      </Motion.main>

      {showCookieBanner && (
        <Motion.div 
          className="cookie-banner"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className="cookie-content">
            <span className="cookie-icon">🍪</span>
            <div className="cookie-text">
              <h4>Cookie Consent</h4>
              <p>We use cookies to enhance your experience and ensure security. By continuing, you agree to our use of cookies.</p>
            </div>
          </div>
          <button className="btn mini primary" onClick={handleAcceptCookies}>Accept All</button>
        </Motion.div>
      )}
    </>
  );
}

export default App;
