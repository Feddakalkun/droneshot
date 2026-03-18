import { useState, useCallback, useRef } from 'react';

type Mode = 'single' | 'dual';

export interface UploadData {
  startFrame: File;
  endFrame: File | null; // null = auto-generate the end angle
}

interface UploadFormProps {
  onSubmit: (data: UploadData) => void;
  disabled: boolean;
}

function DropZone({ label, sublabel, preview, onFile, onClear }: {
  label: string;
  sublabel: string;
  preview: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  }, [onFile]);

  if (preview) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-dark-900 border border-dark-700 aspect-video">
        <img src={preview} alt={label} className="w-full h-full object-cover" />
        <button
          onClick={onClear}
          className="absolute top-2 right-2 bg-dark-900/80 hover:bg-dark-800 text-dark-300 hover:text-dark-100
                     rounded-full p-1.5 backdrop-blur-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-dark-950/80 to-transparent px-3 py-2">
          <span className="text-xs font-medium text-dark-200">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl aspect-video flex flex-col items-center justify-center
        cursor-pointer transition-all duration-200 text-center px-4
        ${dragActive
          ? 'border-accent bg-accent/5'
          : 'border-dark-700 hover:border-dark-500 hover:bg-dark-900/30'
        }
      `}
    >
      <svg className="w-8 h-8 text-dark-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
      <p className="text-sm font-medium text-dark-300">{label}</p>
      <p className="text-xs text-dark-500 mt-0.5">{sublabel}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
        className="hidden"
      />
    </div>
  );
}

function validateFile(f: File): string | null {
  if (!f.type.startsWith('image/')) return 'Please upload an image file (JPG, PNG, etc.)';
  if (f.size > 10 * 1024 * 1024) return 'Image is too large. Please use a photo under 10 MB.';
  return null;
}

function readPreview(f: File, cb: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => cb(e.target?.result as string);
  reader.readAsDataURL(f);
}

export default function UploadForm({ onSubmit, disabled }: UploadFormProps) {
  const [mode, setMode] = useState<Mode>('dual');
  const [startFile, setStartFile] = useState<File | null>(null);
  const [endFile, setEndFile] = useState<File | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);
  const [singleDragActive, setSingleDragActive] = useState(false);

  const handleStartFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(null);
    setStartFile(f);
    readPreview(f, setStartPreview);
  }, []);

  const handleEndFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(null);
    setEndFile(f);
    readPreview(f, setEndPreview);
  }, []);

  const handleSubmit = () => {
    if (!startFile || disabled) return;
    onSubmit({
      startFrame: startFile,
      endFrame: mode === 'dual' ? endFile : null,
    });
  };

  const handleReset = () => {
    setStartFile(null);
    setEndFile(null);
    setStartPreview(null);
    setEndPreview(null);
    setError(null);
    if (singleInputRef.current) singleInputRef.current.value = '';
  };

  const canSubmit = startFile && (mode === 'single' || (mode === 'dual' && endFile));

  return (
    <div className="w-full space-y-5">
      {/* Mode toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-dark-900 rounded-xl p-1 border border-dark-800">
          <button
            onClick={() => setMode('dual')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'dual'
                ? 'bg-dark-700 text-dark-100 shadow-sm'
                : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            Start &amp; end frame
          </button>
          <button
            onClick={() => { setMode('single'); setEndFile(null); setEndPreview(null); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'single'
                ? 'bg-dark-700 text-dark-100 shadow-sm'
                : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            One photo (AI angle)
          </button>
        </div>
      </div>

      {/* Single mode */}
      {mode === 'single' && (
        <>
          {!startPreview ? (
            <div
              onDrop={(e) => { e.preventDefault(); setSingleDragActive(false); if (e.dataTransfer.files[0]) handleStartFile(e.dataTransfer.files[0]); }}
              onDragOver={(e) => { e.preventDefault(); setSingleDragActive(true); }}
              onDragLeave={() => setSingleDragActive(false)}
              onClick={() => singleInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-12 sm:p-16 text-center cursor-pointer
                transition-all duration-200
                ${singleDragActive
                  ? 'border-accent bg-accent/5 scale-[1.01]'
                  : 'border-dark-700 hover:border-dark-500 hover:bg-dark-900/30'
                }
              `}
            >
              <div className="mb-5">
                <div className="w-14 h-14 rounded-full bg-dark-800 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                </div>
              </div>
              <p className="text-base font-medium text-dark-200 mb-1">
                Drop your property photo here
              </p>
              <p className="text-sm text-dark-500">
                or click to browse your files
              </p>
              <p className="text-xs text-dark-600 mt-3">
                We'll automatically create the camera movement
              </p>
              <input
                ref={singleInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => { if (e.target.files?.[0]) handleStartFile(e.target.files[0]); }}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="relative rounded-2xl overflow-hidden bg-dark-900 border border-dark-700">
                <img src={startPreview} alt="Property photo" className="w-full max-h-[420px] object-contain" />
                <button
                  onClick={handleReset}
                  className="absolute top-3 right-3 bg-dark-900/80 hover:bg-dark-800 text-dark-300 hover:text-dark-100
                             rounded-full p-2 backdrop-blur-sm transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dual mode */}
      {mode === 'dual' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <DropZone
              label="Start frame"
              sublabel="Beginning of the flyby"
              preview={startPreview}
              onFile={handleStartFile}
              onClear={() => { setStartFile(null); setStartPreview(null); }}
            />
            <DropZone
              label="End frame"
              sublabel="End of the flyby"
              preview={endPreview}
              onFile={handleEndFile}
              onClear={() => { setEndFile(null); setEndPreview(null); }}
            />
          </div>
          {/* Arrow between frames */}
          {startPreview && endPreview && (
            <div className="flex items-center justify-center gap-3 text-dark-500">
              <div className="h-px flex-1 bg-dark-800" />
              <div className="flex items-center gap-2 text-xs">
                <span>Start</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span>End</span>
              </div>
              <div className="h-px flex-1 bg-dark-800" />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {/* Submit button */}
      {canSubmit && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleSubmit}
            disabled={disabled}
            className={`
              px-10 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 text-base
              ${disabled
                ? 'bg-dark-600 cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover active:scale-[0.97] shadow-lg shadow-accent/20'
              }
            `}
          >
            Create Video
          </button>
        </div>
      )}
    </div>
  );
}
