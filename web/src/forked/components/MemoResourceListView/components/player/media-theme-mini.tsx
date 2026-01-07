import { MediaPlaybackRateMenu, MediaPlaybackRateMenuButton } from "media-chrome/dist/react/menu/index";
import {
  MediaController,
  MediaControlBar,
  MediaTimeRange,
  MediaTimeDisplay,
  MediaLoadingIndicator,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaMuteButton,
  MediaPipButton,
  MediaFullscreenButton,
  MediaErrorDialog,
  MediaDurationDisplay,
  MediaPosterImage,
} from "media-chrome/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

// 全局音量状态管理
const globalVolumeState = {
  muted: false,
  volume: 1,
  listeners: new Set<() => void>(),

  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    this.notifyListeners();
  },

  setVolume(volume: number) {
    if (this.volume === volume) return;
    this.volume = volume;
    this.notifyListeners();
  },

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },

  notifyListeners() {
    this.listeners.forEach((listener) => listener());
  },
};

interface PlayerProps {
  src?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: "auto" | "metadata" | "none";
  poster?: string;
  crossOrigin?: "" | "anonymous" | "use-credentials";
}

const Player = ({ src, autoPlay = false, loop = false, preload = "auto", poster, crossOrigin = "" }: PlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localMuted, setLocalMuted] = useState(globalVolumeState.muted);
  const [localVolume, setLocalVolume] = useState(globalVolumeState.volume);
  const isUpdatingFromGlobalRef = useRef(false);

  // 移动端判断，通过媒体查询是否匹配小屏幕 640px
  const isMobile = useMemo(() => {
    return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
  }, []);

  const chromeStyles = useMemo(() => {
    const styles: any = {
      "--media-primary-color": "white",
      display: "flex",
      width: "100%",
      height: "100%",
      backgroundColor: "black",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    };

    if (isMobile) {
      styles["--media-control-padding"] = "10px";
    }

    return styles;
  }, [isMobile]);

  // 订阅全局状态变化
  useEffect(() => {
    const unsubscribe = globalVolumeState.subscribe(() => {
      isUpdatingFromGlobalRef.current = true;
      setLocalMuted(globalVolumeState.muted);
      setLocalVolume(globalVolumeState.volume);
    });
    return unsubscribe;
  }, []);

  // 同步 video 元素的状态到全局
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVolumeChange = () => {
      // 避免循环更新：如果是由全局状态触发的更新，不要再次更新全局状态
      if (isUpdatingFromGlobalRef.current) {
        isUpdatingFromGlobalRef.current = false;
        return;
      }
      globalVolumeState.setMuted(video.muted);
      globalVolumeState.setVolume(video.volume);
    };

    video.addEventListener("volumechange", handleVolumeChange);
    return () => video.removeEventListener("volumechange", handleVolumeChange);
  }, []);

  // 应用全局状态到 video 元素
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = localMuted;
      video.volume = localVolume;
    }
  }, [localMuted, localVolume]);

  return (
    <MediaController hotkeys={"noarrowleft noarrowright"} style={chromeStyles as any} defaultSubtitles noDefaultStore={false}>
      <video
        ref={videoRef}
        suppressHydrationWarning={true}
        style={{ width: "100%", height: "100%", aspectRatio: "16/9", objectFit: "contain" }}
        slot="media"
        src={src}
        preload={preload}
        autoPlay={autoPlay}
        muted={localMuted}
        loop={loop}
        crossOrigin={crossOrigin}
      ></video>
      <MediaPosterImage slot="poster" src={poster} style={{ width: "100%", height: "100%", aspectRatio: "16/9", objectFit: "contain" }} />
      <MediaErrorDialog role="dialog" slot="dialog"></MediaErrorDialog>
      <MediaLoadingIndicator
        noAutohide
        slot="centered-chrome"
        style={{ "--media-loading-indicator-icon-height": "200px" } as any}
      ></MediaLoadingIndicator>
      <MediaPlaybackRateMenu role="menu" hidden anchor="auto" rates={[0.5, 1, 2]} />
      <MediaControlBar>
        {isMobile ? (
          <>
            <MediaPlayButton mediaPaused={true}></MediaPlayButton>
            <MediaMuteButton mediaVolumeLevel="off"></MediaMuteButton>
            <MediaTimeDisplay></MediaTimeDisplay>
            <MediaTimeRange></MediaTimeRange>
            <MediaDurationDisplay></MediaDurationDisplay>
            <MediaPlaybackRateMenuButton></MediaPlaybackRateMenuButton>
            <MediaFullscreenButton></MediaFullscreenButton>
          </>
        ) : (
          <>
            <MediaPlayButton mediaPaused={true}></MediaPlayButton>
            <MediaSeekBackwardButton seekOffset={5}></MediaSeekBackwardButton>
            <MediaSeekForwardButton seekOffset={5}></MediaSeekForwardButton>
            <MediaTimeDisplay></MediaTimeDisplay>
            <MediaTimeRange></MediaTimeRange>
            <MediaDurationDisplay></MediaDurationDisplay>
            <MediaMuteButton mediaVolumeLevel="off"></MediaMuteButton>
            <MediaPlaybackRateMenuButton></MediaPlaybackRateMenuButton>
            <MediaPipButton></MediaPipButton>
            <MediaFullscreenButton></MediaFullscreenButton>
          </>
        )}
      </MediaControlBar>
    </MediaController>
  );
};

class MediaThemeMini extends HTMLElement {
  private root?: ReturnType<typeof createRoot>;
  private isRootUnmounted = false;

  static get observedAttributes() {
    return ["src", "autoplay", "muted", "loop", "preload", "poster", "crossorigin"];
  }

  connectedCallback() {
    // 检查是否已经有 Shadow DOM，避免重复创建
    if (!this.shadowRoot) {
      const rootDiv = document.createElement("div");
      rootDiv.style.width = "100%";
      rootDiv.style.height = "100%";
      this.attachShadow({ mode: "open" }).appendChild(rootDiv);
    }

    // 如果 root 已被卸载或不存在，重新创建
    if (!this.root || this.isRootUnmounted) {
      const rootDiv = this.shadowRoot!.firstChild as HTMLElement;
      if (rootDiv) {
        this.root = createRoot(rootDiv);
        this.isRootUnmounted = false;
      }
    }

    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  disconnectedCallback() {
    // 延迟卸载，避免在快速切换时出现问题
    setTimeout(() => {
      if (this.root && !this.isConnected) {
        this.root.unmount();
        this.isRootUnmounted = true;
      }
    }, 100);
  }

  private render() {
    if (!this.root) return;

    const srcAttr = this.getAttribute("src");
    const props: PlayerProps = {
      src: srcAttr ?? undefined,
      autoPlay: this.hasAttribute("autoplay"),
      muted: this.hasAttribute("muted") ? true : false, // 默认静音，除非明确设置 muted="false"
      loop: this.hasAttribute("loop"),
      preload: (this.getAttribute("preload") as PlayerProps["preload"]) || "auto",
      poster: this.getAttribute("poster") ?? undefined,
      crossOrigin: (this.getAttribute("crossorigin") as PlayerProps["crossOrigin"]) || "",
    };

    console.log("MediaThemeMini render props:", props);

    this.root.render(<Player {...props} />);
  }
}

if (!globalThis.customElements.get("media-theme-mini")) {
  globalThis.customElements.define("media-theme-mini", MediaThemeMini);
}

export default MediaThemeMini;
