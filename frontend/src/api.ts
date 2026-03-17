const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface JobStatus {
  job_id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  has_video?: boolean;
  error?: string;
}

export async function submitJob(startFrame: File, endFrame: File | null): Promise<string> {
  const formData = new FormData();
  formData.append('start_frame', startFrame);
  if (endFrame) {
    formData.append('end_frame', endFrame);
  }

  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }

  const data = await res.json();
  return data.job_id;
}

export async function pollStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/status/${jobId}`);
  if (!res.ok) {
    throw new Error('Failed to check status');
  }
  return res.json();
}

export function getDownloadUrl(jobId: string): string {
  return `${API_BASE}/download/${jobId}`;
}
