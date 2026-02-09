"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  // --- Constants ---
  const CHAR_SETS = {
    simple: " @%#*+=-:. ",
    complex: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`' . ",
  };

  const FONT_ASPECT_RATIO = 0.55;

  // --- State ---
  const [mediaType, setMediaType] = useState(null);
  const [asciiWidth, setAsciiWidth] = useState(100);
  const [isInverted, setIsInverted] = useState(false);
  const [charsetKey, setCharsetKey] = useState("simple");
  const [isPlaying, setIsPlaying] = useState(false);

  const animationRef = useRef(null);

  // --- Refs for DOM elements ---
  const asciiRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const toastRef = useRef(null);
  const mainStageRef = useRef(null);

  // --- File Input Handler ---
  function handleFileSelect(e) {
    if (e.target.files?.[0]) loadFile(e.target.files[0]);
  }

  function loadFile(file) {
    const url = URL.createObjectURL(file);
    stopVideo();

    if (file.type.startsWith("image/")) {
      setupImage(url);
    } else if (file.type.startsWith("video/")) {
      setupVideo(url);
    } else {
      alert("Unsupported file type. Please upload an image or video.");
    }
  }

  // --- Image Setup ---
  function setupImage(url) {
    setMediaType("image");
    const img = imgRef.current;
    img.onload = () => {
      refreshOutput();
    };
    img.src = url;
  }

  // --- Video Setup ---
  function setupVideo(url) {
    setMediaType("video");

    const video = videoRef.current;
    video.src = url;
    video.volume = 0;

    video.onloadedmetadata = () => {
      const ascii = processFrame(video);
      asciiRef.current.textContent = ascii;
      fitAscii();
    };

    video
      .play()
      .then(() => {
        setIsPlaying(true);
        loopVideo();
      })
      .catch(() => {
        setIsPlaying(false);
      });
  }

  // --- Refresh Output (Image Only) ---
  function refreshOutput() {
    const ascii = processFrame(imgRef.current);
    console.log("ASCII:", ascii.slice(0, 50));
    asciiRef.current.textContent = ascii;
    fitAscii();
  }

  // --- Fit ASCII to Screen ---
  function fitAscii() {
    const pre = asciiRef.current;
    const main = mainStageRef.current;

    if (!pre || !main) return;

    pre.style.transform = "translate(-50%, -50%) scale(1)";

    const contentWidth = pre.offsetWidth;
    const contentHeight = pre.offsetHeight;
    const containerWidth = main.clientWidth;
    const containerHeight = main.clientHeight;

    if (!contentWidth || !contentHeight) return;

    const padding = 20;
    const scaleX = (containerWidth - padding) / contentWidth;
    const scaleY = (containerHeight - padding) / contentHeight;

    const scale = Math.min(scaleX, scaleY);

    pre.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  // --- Stop Video ---
  function stopVideo() {
    cancelAnimationFrame(animationRef.current);
    videoRef.current.pause();
    setIsPlaying(false);
  }

  // --- Play/Pause Toggle ---
  function toggleVideoPlay() {
    const video = videoRef.current;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
      loopVideo();
    }
  }

  // --- Audio Toggle ---
  function toggleAudio() {
    const video = videoRef.current;
    video.muted = !video.muted;
  }

  // --- Video Loop ---
  function loopVideo() {
    if (!isPlaying) return;

    const ascii = processFrame(videoRef.current);
    asciiRef.current.textContent = ascii;

    animationRef.current = requestAnimationFrame(loopVideo);
  }

  // --- ASCII Engine ---
  function processFrame(source) {
    const width = asciiWidth;
    const originalWidth = source.videoWidth || source.naturalWidth;
    const originalHeight = source.videoHeight || source.naturalHeight;

    if (!originalWidth || !originalHeight) return "";

    const aspectRatio = originalHeight / originalWidth;
    const height = Math.floor(width * aspectRatio * FONT_ASPECT_RATIO);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(source, 0, 0, width, height);

    const { data } = ctx.getImageData(0, 0, width, height);

    let ascii = "";
    const charset = CHAR_SETS[charsetKey];
    const charLen = charset.length;

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const offset = (i * width + j) * 4;
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

        if (isInverted) idx = charLen - 1 - idx;

        ascii += charset[idx];
      }
      ascii += "\n";
    }

    return ascii;
  }

  // --- Clipboard / Toast ---
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

  // --- Resize listener ---
  useEffect(() => {
    function onResize() {
      if (mediaType) fitAscii();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mediaType, asciiWidth]);

  // --- Drag & Drop ---
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
      <header className="bg-gray-800 border-b border-gray-700 p-4 shrink-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-black font-bold font-mono">
              #
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">ASCII Studio</h1>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 text-sm w-full md:w-auto justify-center md:justify-end">
            {/* Upload */}
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-md flex items-center gap-2">
              <span>Upload Media</span>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
            </label>
            {/* Resolution */}
            <div className="flex flex-col items-center w-32">
              <label className="text-xs text-gray-400 mb-1">Resolution: {asciiWidth}</label>
              <input
                type="range"
                min="20"
                max="300"
                value={asciiWidth}
                onChange={(e) => {
                  setAsciiWidth(parseInt(e.target.value));
                  refreshOutput();
                }}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>
            {/* Toggles */}
            <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-lg border border-gray-700">
              <button
                onClick={() => {
                  setIsInverted(!isInverted);
                  refreshOutput();
                }}
                className={` px-3 py-1 rounded hover:bg-gray-700 transition ${isInverted ? "bg-blue-600 text-white" : "text-gray-400"} `}
              >
                Invert
              </button>
              <div className="w-px h-4 bg-gray-700"></div>
              <button
                onClick={() => {
                  setCharsetKey(charsetKey === "simple" ? "complex" : "simple");
                  refreshOutput();
                }}
                className="px-3 py-1 rounded hover:bg-gray-700 transition text-gray-400"
              >
                {charsetKey === "simple" ? "Simple" : "Complex"}
              </button>
            </div>
            {/* Copy */}
            <button onClick={copyToClipboard} className="ml-2 text-gray-400 hover:text-white transition">
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
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] leading-none text-white whitespace-pre select-text origin-center"
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
