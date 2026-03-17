interface VideoResultProps {
  videoUrl: string;
  onReset: () => void;
}

export default function VideoResult({ videoUrl, onReset }: VideoResultProps) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Success */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-400 text-sm font-medium mb-3">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Ready to download
        </div>
        <h3 className="text-xl font-semibold text-dark-100">
          Your listing video is ready
        </h3>
      </div>

      {/* Video player */}
      <div className="rounded-2xl overflow-hidden bg-dark-900 border border-dark-700">
        <video
          src={videoUrl}
          controls
          autoPlay
          loop
          className="w-full"
          style={{ maxHeight: '500px' }}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href={videoUrl}
          download="property-flyby.mp4"
          className="px-8 py-3 rounded-xl font-semibold text-white bg-accent hover:bg-accent-hover
                     active:scale-[0.97] shadow-lg shadow-accent/20 transition-all duration-200
                     inline-flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Video
        </a>
        <button
          onClick={onReset}
          className="px-8 py-3 rounded-xl font-semibold text-dark-300 bg-dark-800 hover:bg-dark-700
                     active:scale-[0.97] transition-all duration-200"
        >
          Create Another
        </button>
      </div>
    </div>
  );
}
