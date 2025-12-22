const thumbnailCache = new Map<string, string>();

const getVideoThumbnail = (videoUrl: string, seekTime = 0.5): Promise<string> => {
  if (thumbnailCache.has(videoUrl)) {
    return Promise.resolve(thumbnailCache.get(videoUrl)!);
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.currentTime = seekTime;

    video.addEventListener("loadeddata", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
        thumbnailCache.set(videoUrl, thumbnail);
        resolve(thumbnail);
      } catch (error) {
        reject(error);
      } finally {
        video.remove();
      }
    });

    video.addEventListener("error", () => {
      video.remove();
      reject("Error loading video");
    });
  });
};

export { thumbnailCache, getVideoThumbnail };
