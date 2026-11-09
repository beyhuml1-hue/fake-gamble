import { useEffect, useRef, useState } from "react";

const MODEL_URL = "/models/blockbet-gold-heads-tails.glb";
const VIEWER_URL =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js";
const DURATION_MS = 1700;

// The coin is a real GLB mesh: solid gold body, raised rim and extruded text.
// The CSS coin appears only while the 3D renderer downloads or if unavailable.
export function GoldCoin3D({ degrees, spinning }: { degrees: number; spinning: boolean }) {
  const slot = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLElement | null>(null);
  const fallback = useRef<HTMLDivElement>(null);
  const currentAngle = useRef(0);
  const frame = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = slot.current;
    if (!node) return;
    const model = document.createElement("model-viewer");
    model.setAttribute("src", MODEL_URL);
    model.setAttribute("alt", "Solid 3D gold coin with HEADS embossed on one side and TAILS on the other.");
    model.setAttribute("camera-orbit", "0deg 88deg 115%");
    model.setAttribute("field-of-view", "35deg");
    model.setAttribute("camera-target", "0m 0m 0m");
    model.setAttribute("environment-image", "neutral");
    model.setAttribute("exposure", "1.3");
    model.setAttribute("shadow-intensity", "0.7");
    model.setAttribute("interaction-prompt", "none");
    model.setAttribute("orientation", "0deg 0deg 0deg");
    model.setAttribute("loading", "eager");
    model.className = "blockbet-coin-viewer";
    model.style.height = "100%";
    model.style.width = "100%";
    model.style.display = "block";

    const load = () => {
      model.setAttribute("orientation", `0deg 0deg ${currentAngle.current}deg`);
      setLoaded(true);
      setFailed(false);
    };
    const error = () => setFailed(true);
    model.addEventListener("load", load);
    model.addEventListener("error", error);
    node.appendChild(model);
    viewer.current = model;

    if (!document.querySelector('script[data-blockbet-model-viewer="true"]')) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = VIEWER_URL;
      script.dataset.blockbetModelViewer = "true";
      script.onerror = () => setFailed(true);
      document.head.appendChild(script);
    }

    // A failed CDN request should never prevent the coinflip game from working.
    const watchdog = window.setTimeout(() => setFailed((wasFailed) => wasFailed || !customElements.get("model-viewer")), 12000);
    return () => {
      window.clearTimeout(watchdog);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      model.removeEventListener("load", load);
      model.removeEventListener("error", error);
      viewer.current = null;
      model.remove();
    };
  }, []);

  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const from = currentAngle.current;
    const to = degrees;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const setAngle = (a: number) => {
      currentAngle.current = a;
      viewer.current?.setAttribute("orientation", `0deg 0deg ${a}deg`);
      if (fallback.current) fallback.current.style.transform = `rotateY(${a}deg)`;
    };
    if (reduceMotion || Math.abs(to - from) < 0.01) {
      setAngle(to);
      return;
    }
    const start = performance.now();
    function animate(now: number) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setAngle(from + (to - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(animate);
      else frame.current = null;
    }
    frame.current = requestAnimationFrame(animate);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [degrees]);

  return (
    <div className={spinning ? "real-coin-stage spinning" : "real-coin-stage"}
      role="img" aria-label={spinning ? "Gold 3D coin flipping" : "Gold 3D coin with heads and tails"}>
      <div ref={slot} className={loaded ? "real-coin-model loaded" : "real-coin-model"} aria-hidden="true" />
      <div className={loaded ? "real-coin-fallback hidden" : "real-coin-fallback"}
        aria-hidden="true" ref={fallback}>
        <div className="gold-fallback-face front"><span>HEADS</span></div>
        <div className="gold-fallback-face back"><span>TAILS</span></div>
        <div className="gold-fallback-edge" />
      </div>
      <div className="real-coin-shadow" aria-hidden="true" />
      {failed && <span className="model-fallback-note">3D preview unavailable — coinflip still works</span>}
    </div>
  );
}
