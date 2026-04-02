import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Download, RefreshCw, Scissors } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [status, setStatus] = useState('IDLE'); // IDLE, PROCESSING, SUCCESS, ERROR
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [message, setMessage] = useState('');

  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setStatus('ERROR');
      setErrorMsg('Please select a valid video file.');
      return;
    }

    setStatus('PROCESSING');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/process`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to start processing video');
      }

      if (data.job_id) {
        setMessage(data.message || 'Uploading and preparing...');
        checkStatus(data.job_id);
      } else {
        setStatus('ERROR');
        setErrorMsg('Invalid response from server.');
      }
    } catch (error) {
      console.error(error);
      setStatus('ERROR');
      setErrorMsg(error.message || 'An unexpected error occurred. Is the backend running?');
    }
  };

  const checkStatus = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/status/${jobId}`);
      if (!response.ok) throw new Error('Failed to fetch status');
      
      const data = await response.json();

      if (data.status === 'success') {
        setStatus('SUCCESS');
        setMessage(data.message);
        setDownloadUrl(`${API_BASE_URL}${data.download_url}`);
        setVideoUrl(`${API_BASE_URL}${data.download_url}`);
      } else if (data.status === 'error') {
        setStatus('ERROR');
        setErrorMsg(data.message || 'An error occurred during processing.');
      } else {
        // Still processing
        setMessage(data.message || 'Analyzing audio & video...');
        setTimeout(() => checkStatus(jobId), 3000);
      }
    } catch (err) {
      console.error(err);
      setStatus('ERROR');
      setErrorMsg('Failed to check status. Is the backend running?');
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
      // Create a spoofed event object to pass to handleFileSelect
      handleFileSelect({ target: { files: e.dataTransfer.files } });
    }
  };

  const renderContent = () => {
    if (status === 'IDLE') {
      return (
        <div 
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="dropzone-icon" />
          <p>Drag and drop your video file here</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>or click to browse</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="video/*"
            style={{ display: 'none' }}
          />
        </div>
      );
    }

    if (status === 'PROCESSING') {
      return (
        <div className="loading-wrapper" style={{ animation: 'fadeIn 0.5s ease' }}>
          <div className="spinner"></div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{message || 'Analyzing Audio & Video...'}</h3>
          <p style={{ color: 'var(--text-muted)' }}>This might take a while for large videos. Sit tight!</p>
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
          <div className="video-player">
            <video controls autoPlay src={videoUrl} />
          </div>
          <div className="controls">
            <button className="btn btn-download" onClick={() => window.open(downloadUrl, '_blank')}>
              <Download size={20} />
              Download Highlights
            </button>
            <button className="btn" onClick={() => { setStatus('IDLE'); setDownloadUrl(null); }}>
              <RefreshCw size={20} />
              Process Another
            </button>
          </div>
        </div>
      );
    }

    if (status === 'ERROR') {
      return (
        <div className="result-section" style={{ alignItems: 'center' }}>
          <div className="status-badge error" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={24} />
            Analysis Failed
          </div>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem' }}>
            {errorMsg}
          </p>
          <button className="btn" onClick={() => setStatus('IDLE')}>
            <RefreshCw size={20} />
            Try Again
          </button>
        </div>
      );
    }
  };

  return (
    <>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="app-container">
        <div className="header">
          <h1>
            Auto<span style={{ color: 'var(--text-main)' }}>Editor</span>
          </h1>
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Scissors size={20} /> Smart Video Highlights Using Machine Learning
          </p>
        </div>
        
        {renderContent()}

      </div>
    </>
  );
}

export default App;
