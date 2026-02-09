"use client";

import { useEffect, useRef, useState } from "react";

const CHAR_SETS = {
  simple: " @%#*+=-:. ",
  complex: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`' . ",
};

const FONT_ASPECT_RATIO = 0.55;
const SCALE_PADDING = 20;

export default function Home() {
  // State
  const [mediaType, setMediaType] = useState(null);
  const [asciiWidth, setAsciiWidth] = useState(100);
  const [isInverted, setIsInverted] = useState(false);
  const [charsetKey, setCharsetKey] = useState("simple");

  // Refs
  const animationRef = useRef(null);
  const fitRafRef = useRef(null);
  const isPlayingRef = useRef(false);
  const objectUrlRef = useRef(null);
  const settingsRef = useRef({
    asciiWidth,
    isInverted,
    charsetKey,
  });

  const asciiRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const toastRef = useRef(null);
  const mainStageRef = useRef(null);

  // Helpers
  function revokeObjectUrl() {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  // Media loading
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }

  function handleResolutionChange(e) {
    setAsciiWidth(Number(e.target.value));
  }

  function toggleInvert() {
    setIsInverted((prev) => !prev);
  }

  function toggleCharset() {
    setCharsetKey((prev) => (prev === "simple" ? "complex" : "simple"));
  }

  function loadFile(file) {
    revokeObjectUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    stopVideo();

    if (file.type.startsWith("image/")) {
      setupImage(url);
    } else if (file.type.startsWith("video/")) {
      setupVideo(url);
    } else {
      alert("Unsupported file type. Please upload an image or video.");
    }
  }

  function setupImage(url) {
    setMediaType("image");
    const img = imgRef.current;
    if (!img) return;
    img.onload = () => {
      refreshOutput("image");
    };
    img.src = url;
  }

  function setupVideo(url) {
    setMediaType("video");

    const video = videoRef.current;
    if (!video) return;
    video.src = url;
    video.volume = 0;
    video.muted = true;

    video.onloadeddata = () => {
      refreshOutput("video");
    };

    video
      .play()
      .then(() => {
        isPlayingRef.current = true;
        loopVideo();
      })
      .catch(() => {
        isPlayingRef.current = false;
      });
  }

  function refreshOutput(forceType) {
    const type = forceType || mediaType;
    if (!type) return;

    const source = type === "video" ? videoRef.current : imgRef.current;
    if (!source) return;
    if (type === "video" && source.readyState < 2) return;
    if (type === "image" && (!source.complete || source.naturalWidth === 0)) return;

    const ascii = processFrame(source);
    const pre = asciiRef.current;
    if (!pre) return;
    pre.textContent = ascii;
    scheduleFit();
  }

  // ASCII rendering
  function fitAscii() {
    const pre = asciiRef.current;
    const main = mainStageRef.current;

    if (!pre || !main) return;

    const containerWidth = main.clientWidth;
    const containerHeight = main.clientHeight;

    if (!containerWidth || !containerHeight) return;

    const contentWidth = pre.scrollWidth || pre.offsetWidth;
    const contentHeight = pre.scrollHeight || pre.offsetHeight;

    if (!contentWidth || !contentHeight) return;

    const scaleX = (containerWidth - SCALE_PADDING) / contentWidth;
    const scaleY = (containerHeight - SCALE_PADDING) / contentHeight;

    const scale = Math.min(scaleX, scaleY);
    pre.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function scheduleFit() {
    if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
    fitRafRef.current = requestAnimationFrame(() => {
      fitAscii();
    });
  }

  function stopVideo() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    isPlayingRef.current = false;
    const video = videoRef.current;
    if (video) video.pause();
  }

  function loopVideo() {
    if (!isPlayingRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    const ascii = processFrame(video);
    const pre = asciiRef.current;
    if (pre) pre.textContent = ascii;
    animationRef.current = requestAnimationFrame(loopVideo);
  }

  function processFrame(source) {
    const originalWidth = source.videoWidth || source.naturalWidth;
    const originalHeight = source.videoHeight || source.naturalHeight;

    if (!originalWidth || !originalHeight) return "";

    const { asciiWidth: liveWidth, charsetKey: liveCharset, isInverted: liveInvert } = settingsRef.current;
    const aspectRatio = originalHeight / originalWidth;
    const height = Math.floor(liveWidth * aspectRatio * FONT_ASPECT_RATIO);

    const canvas = canvasRef.current;
    if (!canvas) return "";
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";

    canvas.width = liveWidth;
    canvas.height = height;

    ctx.drawImage(source, 0, 0, liveWidth, height);

    const { data } = ctx.getImageData(0, 0, liveWidth, height);

    let ascii = "";
    const charset = CHAR_SETS[liveCharset];
    const charLen = charset.length;

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < liveWidth; j++) {
        const offset = (i * liveWidth + j) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const a = data[offset + 3];

        if (a === 0) {
          ascii += " ";
          continue;
        }

        const brightness = 0.21 * r + 0.72 * g + 0.07 * b;
        let idx = Math.floor((brightness / 255) * (charLen - 1));

        if (liveInvert) idx = charLen - 1 - idx;

        ascii += charset[idx];
      }
      ascii += "\n";
    }

    return ascii;
  }

  // Clipboard / toast
  function copyToClipboard() {
    const text = asciiRef.current?.textContent;
    if (!text) return;

    navigator.clipboard.writeText(text).then(showToast);
  }

  function showToast() {
    const toast = toastRef.current;
    if (!toast) return;

    toast.classList.remove("translate-y-20", "opacity-0");
    setTimeout(() => {
      toast.classList.add("translate-y-20", "opacity-0");
    }, 2000);
  }

  useEffect(() => {
    return () => {
      revokeObjectUrl();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
      animationRef.current = null;
      fitRafRef.current = null;
    };
  }, []);

  useEffect(() => {
    settingsRef.current = { asciiWidth, isInverted, charsetKey };
  }, [asciiWidth, isInverted, charsetKey]);

  useEffect(() => {
    function onResize() {
      if (mediaType) scheduleFit();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mediaType]);

  useEffect(() => {
    if (mediaType) refreshOutput();
  }, [asciiWidth, charsetKey, isInverted, mediaType]);

  // Drag & drop
  useEffect(() => {
    function onDragOver(e) {
      e.preventDefault();
    }
    function onDrop(e) {
      e.preventDefault();
      if (e.dataTransfer.files?.[0]) loadFile(e.dataTransfer.files[0]);
    }

    document.body.addEventListener("dragover", onDragOver);
    document.body.addEventListener("drop", onDrop);

    return () => {
      document.body.removeEventListener("dragover", onDragOver);
      document.body.removeEventListener("drop", onDrop);
    };
  }, [loadFile]);

  return (
    <>
      <header className="bg-slate-950/85 border-b border-white/10 p-4 md:p-5 shrink-0 z-10 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-300 to-emerald-500 rounded-lg flex items-center justify-center text-black font-bold font-mono shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]">
              #
            </div>
            <div className="flex flex-col leading-tight">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white">ASCII Editor</h1>
              <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/80">Media To Type</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 text-sm w-full lg:w-auto justify-center lg:justify-end">
            {/* Upload */}
            <label className="cursor-pointer bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-md flex items-center gap-2 border border-white/10">
              <span>Upload Media</span>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
            </label>
            {/* Resolution */}
            <div className="flex flex-col gap-2 items-center w-36 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <div>
                <label className="text-[11px] text-slate-300 mr-2 uppercase tracking-[0.14em]">Resolution</label>
                <span className="text-sm text-white font-medium">{asciiWidth}</span>
              </div>
              <input
                type="range"
                min="20"
                max="300"
                value={asciiWidth}
                onChange={handleResolutionChange}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
            {/* Toggles */}
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
              <button
                onClick={toggleInvert}
                className={` px-3 py-1 rounded hover:bg-white/10 transition ${
                  isInverted ? "bg-emerald-500 text-black" : "text-slate-300"
                } `}
              >
                Invert
              </button>
              <div className="w-px h-4 bg-white/10"></div>
              <button onClick={toggleCharset} className="px-3 py-1 rounded hover:bg-white/10 transition text-slate-300">
                {charsetKey === "simple" ? "Simple" : "Complex"}
              </button>
            </div>
            {/* Copy */}
            <button
              onClick={copyToClipboard}
              className="ml-2 text-slate-300 hover:text-white transition bg-white/5 border border-white/10 rounded-lg p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN OUTPUT AREA */}
      <main ref={mainStageRef} className="flex-1 overflow-hidden bg-black relative w-full h-full p-4">
        {/* Placeholder */}
        {!mediaType && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-gray-500 select-none z-0">
            <div className="mb-4 opacity-50">
              <svg
                className="w-16 h-16"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium">Drop an image or video here</p>
            <p className="text-sm">or click "Upload Media" above</p>
          </div>
        )}

        {/* ASCII Output */}
        <pre
          ref={asciiRef}
          className="m-0 absolute top-1/2 left-1/2 text-[10px] leading-none text-white whitespace-pre select-text origin-center font-mono"
        ></pre>

        {/* Hidden Elements */}
        <canvas ref={canvasRef} className="hidden"></canvas>
        <video ref={videoRef} className="hidden" playsInline loop muted></video>
        <img ref={imgRef} className="hidden" />
      </main>

      {/* Toast */}
      <div
        ref={toastRef}
        className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg transform translate-y-20 opacity-0 transition-all duration-300 z-50"
      >
        Copied to clipboard!
      </div>
    </>
  );
}
