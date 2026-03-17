import { useState, useEffect, useRef } from 'react';
import UploadForm, { type UploadData } from './components/UploadForm';
import ProgressBar from './components/ProgressBar';
import VideoResult from './components/VideoResult';
import { submitJob, pollStatus, getDownloadUrl, type JobStatus } from './api';

type AppState = 'upload' | 'processing' | 'result' | 'error';

export default function App() {
  const [state, setState] = useState<AppState>('upload');
  const [, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('IN_QUEUE');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleSubmit = async (data: UploadData) => {
    setState('processing');
    setError(null);
    setStartTime(Date.now());
    setJobStatus('IN_QUEUE');

    try {
      const id = await submitJob(data.startFrame, data.endFrame);
      setJobId(id);

      pollRef.current = setInterval(async () => {
        try {
          const status: JobStatus = await pollStatus(id);
          setJobStatus(status.status);

          if (status.status === 'COMPLETED' && status.has_video) {
            stopPolling();
            setVideoUrl(getDownloadUrl(id));
            setState('result');
          } else if (status.status === 'FAILED') {
            stopPolling();
            setError(status.error || 'Something went wrong. Please try again.');
            setState('error');
          }
        } catch {
          // Transient poll error — keep trying
        }
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start video creation. Please try again.');
      setState('error');
    }
  };

  const handleReset = () => {
    stopPolling();
    setState('upload');
    setJobId(null);
    setVideoUrl(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-800/50 backdrop-blur-sm bg-dark-950/80 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Drone / camera icon */}
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-dark-100 tracking-tight">DroneShot</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        {state === 'upload' && (
          <div className="w-full max-w-2xl mx-auto space-y-10">
            {/* Hero */}
            <div className="text-center space-y-4">
              <h1 className="text-4xl sm:text-5xl font-bold text-dark-50 leading-tight">
                Listing videos,<br />
                <span className="text-accent">in minutes.</span>
              </h1>
              <p className="text-lg text-dark-400 max-w-md mx-auto">
                Upload a property photo and get a stunning flyby video
                you can use in your listings.
              </p>
            </div>

            <UploadForm onSubmit={handleSubmit} disabled={false} />

            {/* How it works */}
            <div className="pt-6 border-t border-dark-800/50">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center mx-auto text-sm font-bold text-dark-300">1</div>
                  <p className="text-sm text-dark-400">Upload a photo<br/>of the property</p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center mx-auto text-sm font-bold text-dark-300">2</div>
                  <p className="text-sm text-dark-400">We create a<br/>flyby video</p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center mx-auto text-sm font-bold text-dark-300">3</div>
                  <p className="text-sm text-dark-400">Download &amp; add<br/>to your listing</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {state === 'processing' && (
          <ProgressBar status={jobStatus} startTime={startTime} />
        )}

        {state === 'result' && videoUrl && (
          <VideoResult videoUrl={videoUrl} onReset={handleReset} />
        )}

        {state === 'error' && (
          <div className="w-full max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-dark-100 mb-2">
                Something went wrong
              </h3>
              <p className="text-dark-400 text-sm">{error}</p>
            </div>
            <button
              onClick={handleReset}
              className="px-8 py-3 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover
                         active:scale-95 shadow-lg shadow-accent/20 transition-all duration-200"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-800/50 py-4">
        <p className="text-center text-xs text-dark-600">
          DroneShot &middot; Videos typically ready in 2-4 minutes
        </p>
      </footer>
    </div>
  );
}
