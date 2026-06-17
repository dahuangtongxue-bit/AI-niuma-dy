// 浏览器端视频抽帧：用 <video>+<canvas> 抓取视频的几个画面帧（无需 ffmpeg）
// 用于阿抖"素材成片"：把视频抽成几张图，送视觉模型看懂内容
export async function extractVideoFrames(file, count = 3, maxW = 512) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const frames = [];
    let duration = 0;

    video.onloadedmetadata = async () => {
      duration = video.duration || 0;
      if (!duration || !isFinite(duration)) { URL.revokeObjectURL(url); return reject(new Error('读不到视频时长')); }
      // 取均匀分布的几个时间点（避开最开头最结尾）
      const times = [];
      for (let i = 0; i < count; i++) {
        times.push(duration * (i + 1) / (count + 1));
      }
      try {
        for (const t of times) {
          const frame = await seekAndGrab(video, t, maxW);
          if (frame) frames.push(frame);
        }
        URL.revokeObjectURL(url);
        resolve({ frames, duration: Math.round(duration) });
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('视频加载失败')); };
  });
}

function seekAndGrab(video, time, maxW) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      try {
        const ratio = video.videoHeight / video.videoWidth || 1;
        const w = Math.min(maxW, video.videoWidth || maxW);
        const h = Math.round(w * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        video.removeEventListener('seeked', onSeeked);
        resolve(dataUrl);
      } catch (e) { reject(e); }
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

// 图片文件直接读成 dataURL（缩小）
export async function imageToDataUrl(file, maxW = 512) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = img.height / img.width || 1;
      const w = Math.min(maxW, img.width);
      const h = Math.round(w * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
    img.src = url;
  });
}
