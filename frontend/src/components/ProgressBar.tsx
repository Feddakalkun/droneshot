import { useState, useEffect } from 'react';

interface ProgressBarProps {
  status: string;
  startTime: number;
}

const STEPS = [
  'Uploading your photo',
  'Setting up the camera angle',
  'Creating the flyby video',
  'Finishing up',
];

export default function ProgressBar({ status, startTime }: ProgressBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const estimatedTotal = 210;
  const rawProgress = elapsed / estimatedTotal;
  const progress = Math.min(95, rawProgress < 0.5
    ? rawProgress * 120
    : 60 + (rawProgress - 0.5) * 70
  );

  const stepIndex = Math.min(
    STEPS.length - 1,
    Math.floor(progress / (100 / STEPS.length))
  );

  const getMessage = () => {
    if (status === 'IN_QUEUE') return 'Getting things ready...';
    if (status === 'IN_PROGRESS') return STEPS[stepIndex];
    return 'Processing your photo...';
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      {/* Animated icon */}
      <div className="flex justify-center">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-accent/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        </div>
      </div>

      {/* Message */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-dark-100 mb-1">
          {getMessage()}
        </h3>
        <p className="text-sm text-dark-500">
          This usually takes 2-4 minutes
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-3">
        <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-blue-400 rounded-full transition-all duration-[2000ms] ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-xs text-dark-500">
          {formatTime(elapsed)} elapsed
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            {i < stepIndex ? (
              <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : i === stepIndex ? (
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              </div>
            ) : (
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-dark-700" />
              </div>
            )}
            <span className={`text-sm ${
              i <= stepIndex ? 'text-dark-300' : 'text-dark-600'
            }`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
