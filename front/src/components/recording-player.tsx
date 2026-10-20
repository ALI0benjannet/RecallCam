"use client";

import { useImperativeHandle, useRef, type Ref } from "react";
import { NeutralVideoSkin, Video, VideoPlayer } from "@videojs/react/video";
import "@videojs/react/video/neutral-skin.css";
import "./recording-player.css";

/** Memory-only state for renewing a signed URL for the same recording. */
export type RecordingPlaybackState = {
  time: number;
  paused: boolean;
  volume: number;
  muted: boolean;
  rate: number;
};

export type RecordingPlayerHandle = {
  getPlaybackState: () => RecordingPlaybackState | undefined;
  /** Seconds relative to the original recording, including before metadata loads. */
  seekTo: (seconds: number) => void;
};

type RecordingPlayerProps = {
  ref?: Ref<RecordingPlayerHandle>;
  src: string;
  poster?: string | null;
  title: string;
  initialState?: RecordingPlaybackState;
  onPlaybackError: (code: number) => void;
  onResumeBlocked: () => void;
};

function boundedTime(seconds: number, duration: number) {
  return Math.max(0, Math.min(seconds, Number.isFinite(duration) ? duration : seconds));
}

/** Remount for a new source; only carry initialState across renewals of the same video. */
export function RecordingPlayer({
  ref,
  src,
  poster,
  title,
  initialState,
  onPlaybackError,
  onResumeBlocked,
}: RecordingPlayerProps) {
  const media = useRef<HTMLVideoElement>(null);
  const restored = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const errorReported = useRef(false);

  useImperativeHandle(ref, () => ({
    getPlaybackState() {
      const element = media.current;
      if (!element || element.readyState === 0) return initialState;
      return {
        time: element.currentTime,
        paused: element.paused || element.ended,
        volume: element.volume,
        muted: element.muted,
        rate: element.playbackRate,
      };
    },
    seekTo(seconds) {
      if (!Number.isFinite(seconds)) return;
      const element = media.current;
      if (!element || element.readyState === 0) {
        pendingSeek.current = Math.max(0, seconds);
        return;
      }
      element.currentTime = boundedTime(seconds, element.duration);
    },
  }));

  function restorePlayback() {
    const element = media.current;
    if (!element || restored.current) return;
    restored.current = true;
    if (initialState) {
      element.volume = initialState.volume;
      element.muted = initialState.muted;
      element.playbackRate = initialState.rate;
    }
    const time = pendingSeek.current ?? initialState?.time;
    if (time !== undefined) element.currentTime = boundedTime(time, element.duration);
    pendingSeek.current = null;
    // Initial opening stays paused. A link renewal may resume existing playback.
    if (initialState && !initialState.paused) {
      void element.play().catch((error: unknown) => {
        if (
          media.current === element &&
          error instanceof DOMException &&
          error.name === "NotAllowedError"
        ) {
          onResumeBlocked();
        }
      });
    }
  }

  return (
    <VideoPlayer title={title} poster={poster ?? null}>
      <NeutralVideoSkin className="recallcam-player">
        <Video
          ref={media}
          src={src}
          aria-label={title}
          playsInline
          preload="metadata"
          onLoadedMetadata={restorePlayback}
          onError={(event) => {
            if (errorReported.current) return;
            errorReported.current = true;
            onPlaybackError(event.currentTarget.error?.code ?? 0);
          }}
        />
      </NeutralVideoSkin>
    </VideoPlayer>
  );
}
