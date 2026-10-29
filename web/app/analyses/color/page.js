"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AnalysisLoader from "../../components/AnalysisLoader";
import BackButton from "../../components/BackButton";
import Icon from "../../components/Icon";
import PageShell from "../../components/PageShell";
import { Notice } from "../../components/ui";
import { analysisErrorMessage } from "../../../lib/colorMessages";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
// Slightly longer than the backend's total provider budget (COLOR_ANALYSIS_MAX_SECONDS) so the server answers first.
const ANALYSIS_TIMEOUT_MS = 120000;
const GUIDANCE = [
  ["sun", "Face soft daylight", "A window works best. Avoid strong lamps, colored light and harsh shadows."],
  ["face", "Keep it natural", "Remove tinted glasses and heavy makeup, and turn off filters or beauty modes."],
  ["camera", "Centre your face", "Look straight at the camera and keep your face inside the oval guide."],
];

function cameraErrorMessage(error) {
  const messages = { NotAllowedError: "Camera access was denied. Allow camera permission for this site in your browser's address bar, then choose Try camera again.", SecurityError: "Camera access was blocked. Use localhost or HTTPS, then try again.", NotFoundError: "No camera was found on this device. Connect a camera and try again.", NotReadableError: "The camera is busy or unavailable. Close other apps using the camera and try again.", OverconstrainedError: "This camera doesn't support the requested settings. Try another camera or browser.", AbortError: "The camera stopped before it could start. Try camera again." };
  return messages[error?.name] || "We couldn't start the camera. Check your browser's camera permission and try again.";
}

export default function ColorPage() {
  const videoRef = useRef(null); const streamRef = useRef(null); const mountedRef = useRef(false); const startIdRef = useRef(0); const previewUrlRef = useRef(""); const requestIdRef = useRef("");
  const [cameraState, setCameraState] = useState("starting"); const [photo, setPhoto] = useState(null); const [preview, setPreview] = useState(""); const [error, setError] = useState(null); const [busy, setBusy] = useState(false); const [showCamera, setShowCamera] = useState(false);

  const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; } }, []);

  const startCamera = useCallback(async () => {
    if (typeof window === "undefined" || !mountedRef.current) return;
    const hostname = window.location.hostname.toLowerCase(); const secureContext = window.isSecureContext; const hasGetUserMedia = Boolean(navigator.mediaDevices?.getUserMedia);
    setError(null); setCameraState("starting");
    if (!secureContext && !LOCAL_HOSTS.has(hostname)) { setCameraState("error"); setError({ kind: "camera", text: `Camera access needs a secure (HTTPS) connection. Open this site over HTTPS, or use http://localhost:3000 on your own computer.` }); return; }
    if (!hasGetUserMedia) { setCameraState("unsupported"); setError({ kind: "camera", text: "This browser can't open the camera. Try a current version of Chrome, Edge, Firefox or Safari." }); return; }
    const startId = ++startIdRef.current; stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (!mountedRef.current || startId !== startIdRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      const video = videoRef.current; if (!video) throw new Error("The camera preview is not available yet.");
      streamRef.current = stream; video.srcObject = stream;
      await new Promise((resolve, reject) => { const timeout = window.setTimeout(() => reject(new Error("The camera preview did not become ready.")), 10000); const ready = () => { window.clearTimeout(timeout); resolve(); }; if (video.readyState >= HTMLMediaElement.HAVE_METADATA) ready(); else video.addEventListener("loadedmetadata", ready, { once: true }); });
      await video.play(); if (mountedRef.current && startId === startIdRef.current) setCameraState("ready");
    } catch (cameraError) { if (!mountedRef.current || startId !== startIdRef.current) return; stopCamera(); setCameraState(cameraError?.name === "NotAllowedError" ? "denied" : "error"); setError({ kind: "camera", text: cameraErrorMessage(cameraError) }); }
  }, [stopCamera]);

  useEffect(() => { fetch("/api/users/profile").then((response) => { if (response.status === 401) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); }); }, []);
  useEffect(() => { if (!showCamera) return undefined; mountedRef.current = true; startCamera(); return () => { mountedRef.current = false; ++startIdRef.current; stopCamera(); if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }; }, [showCamera, startCamera, stopCamera]);

  function capture() {
    const video = videoRef.current;
    if (cameraState !== "ready" || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) { setError({ kind: "camera", text: "The camera preview isn't ready yet. Wait a moment, then capture again." }); return; }
    const canvas = document.createElement("canvas"); const scale = Math.min(1, 1024 / video.videoWidth); canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale); const context = canvas.getContext("2d"); context.drawImage(video, 0, 0, canvas.width, canvas.height); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data; let luminance = 0; let samples = 0; for (let index = 0; index < pixels.length; index += 64) { luminance += (0.2126 * pixels[index]) + (0.7152 * pixels[index + 1]) + (0.0722 * pixels[index + 2]); samples += 1; } const averageLuminance = luminance / samples;
    if (averageLuminance < 35 || averageLuminance > 225) { setError({ kind: "lighting", text: averageLuminance < 35 ? "This selfie is too dark for a reliable color reading. Move closer to a window or soft daylight and try again." : "This selfie is too bright for a reliable color reading. Step out of direct light and try again." }); return; }
    canvas.toBlob((blob) => { if (!blob) { setError({ kind: "camera", text: "We couldn't capture that frame. Please try again." }); return; } const captured = new File([blob], "matchmytone-selfie.jpg", { type: "image/jpeg" }); const url = URL.createObjectURL(captured); if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = url; setPhoto(captured); setPreview(url); setError(null); stopCamera(); setCameraState("captured"); }, "image/jpeg", 0.84);
  }

  async function analyze() {
    if (!photo || busy) return; setBusy(true); setError(null);
    // One id per captured selfie: retries of the same selfie can never create a second saved result.
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    const controller = new AbortController(); const abortTimer = window.setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    try {
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(photo); });
      const response = await fetch("/api/analyze/color", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: base64, mimeType: photo.type, request_id: requestIdRef.current }), signal: controller.signal }); const result = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
      if (!response.ok) { setError({ kind: "analysis", text: analysisErrorMessage(result), retry: result.errorCode !== "invalid_image" }); return; }
      if (!result.isFace) { requestIdRef.current = ""; setError({ kind: "quality", text: result.description || "We couldn't find one clear face in this selfie. Please retake it in soft daylight." }); return; }
      if (!result.id || !result.seasonType || !Array.isArray(result.colorsToWear) || result.colorsToWear.length !== 6 || !Array.isArray(result.colorsToAvoid) || result.colorsToAvoid.length !== 3) { setError({ kind: "analysis", text: analysisErrorMessage({ errorCode: "provider_malformed" }), retry: true }); return; }
      sessionStorage.setItem("matchmytone-color-result", JSON.stringify({ ...result, capturedImage: `data:${photo.type};base64,${base64}` })); window.location.assign(`/analyses/color/result?id=${encodeURIComponent(result.id)}`);
    } catch (analysisError) {
      setError({ kind: "analysis", text: analysisError.name === "AbortError" ? "This is taking much longer than usual, so we stopped waiting. Your selfie is saved on this page — please try again." : "We couldn't reach MatchMyTone just now. Check your connection — your selfie is saved on this page.", retry: true });
    } finally { window.clearTimeout(abortTimer); setBusy(false); }
  }

  function retake() { requestIdRef.current = ""; setPhoto(null); setPreview(""); setError(null); setShowCamera(true); startCamera(); }
  const confirmLeave = () => (busy ? "Your colors are still being analysed. Leave this page anyway?" : photo ? "Leave without analysing? Your captured selfie will be discarded." : null);

  return (
    <PageShell width="default" className="module-color">
      <div className="page-toolbar"><BackButton fallback="/dashboard" confirmLeave={confirmLeave} /></div>
      <header className="page-intro reveal"><p className="eyebrow">Color analysis</p><h1>Find the colors that make you <em>glow.</em></h1><p>We&apos;ll read one live camera frame to estimate your undertone and seasonal palette. Your selfie is used for this analysis only and isn&apos;t stored as an image.</p></header>
      {!showCamera && !preview ? (
        <section className="camera-intro reveal" aria-labelledby="before-title">
          <img src="/assets/color1.png" alt="Example of a well-lit, front-facing selfie" className="camera-intro-image" />
          <div>
            <h2 id="before-title">Before you start</h2>
            <ul className="guidance-list">{GUIDANCE.map(([icon, title, text]) => <li key={title}><span className="guidance-icon" aria-hidden="true"><Icon name={icon} /></span><span><strong>{title}</strong>{text}</span></li>)}</ul>
            <p className="hint">Your browser will ask for camera permission. Choose <strong>Allow</strong> — we only use the camera while this page is open.</p>
            <button className="btn btn-primary" type="button" onClick={() => setShowCamera(true)}><Icon name="camera" />Open camera</button>
          </div>
        </section>
      ) : (
        <section className="camera-panel reveal" aria-label="Selfie camera">
          {busy ? (
            <div className="camera-stage is-analyzing"><img src={preview} alt="Your captured selfie, being analysed" /><div className="camera-overlay"><AnalysisLoader module="color" /></div></div>
          ) : !preview ? (
            <div className="camera-stage"><video ref={videoRef} muted playsInline aria-label="Live camera preview" /><div className="camera-guide" aria-hidden="true" /><div className="camera-instructions">Face the light · Centre your face · No filters</div>{cameraState === "starting" && <p className="camera-status" role="status">Starting your camera…</p>}</div>
          ) : (
            <div className="camera-stage"><img src={preview} alt="Your captured selfie preview" /><div className="review-badge"><Icon name="check" size={14} />Ready to review</div></div>
          )}
          {error && <Notice tone={error.kind === "lighting" || error.kind === "quality" ? "info" : "error"} action={["denied", "unsupported", "error"].includes(cameraState) && !preview ? <button className="btn btn-quiet btn-small" type="button" onClick={startCamera}>Try camera again</button> : null}>{error.text}</Notice>}
          {!busy && (
            <div className="action-group">
              {!preview && <button className="btn btn-primary" type="button" onClick={capture} disabled={cameraState !== "ready"}><Icon name="camera" />{cameraState === "starting" ? "Starting camera…" : "Capture selfie"}</button>}
              {preview && <><button className="btn btn-primary" type="button" onClick={analyze}><Icon name={error?.retry ? "refresh" : "sparkle"} />{error?.retry ? "Try again" : "Analyse my colors"}</button><button className="btn btn-secondary" type="button" onClick={retake}><Icon name="refresh" />Retake</button></>}
            </div>
          )}
          {preview && !busy && !error && <p className="hint">Happy with the lighting and framing? Analyse it, or retake if you&apos;d like another try.</p>}
        </section>
      )}
    </PageShell>
  );
}
