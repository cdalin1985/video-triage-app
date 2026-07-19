// Client-side frame extraction. The video never leaves the browser — we sample
// frames onto a canvas and ship compact JPEGs, so the server (and the APIs it
// calls) never needs to touch the platform the video came from.

const FRAME_COUNT = 8;
const MAX_DIM = 768;
const JPEG_QUALITY = 0.7;

export async function extractFrames(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not decode this video in the browser."));
    });

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Video has no readable duration.");
    }

    const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");

    const frames: string[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      // Sample evenly, nudged off the exact endpoints where seeks are flaky.
      const t = duration * ((i + 0.5) / FRAME_COUNT);
      await seek(video, t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      onProgress?.(i + 1, FRAME_COUNT);
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Seek timed out.")), 10_000);
    video.onseeked = () => {
      clearTimeout(timer);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Seek failed."));
    };
    video.currentTime = time;
  });
}
