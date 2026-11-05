"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Kamera-Scanner: BarcodeDetector (falls vorhanden), sonst jsQR auf Canvas-Bildern */
export function Scanner() {
  const { t } = useI18n();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const handle = (text: string) => {
      try {
        const u = new URL(text, window.location.origin);
        if (u.origin === window.location.origin && u.pathname.startsWith("/q/")) {
          stopped = true;
          router.push(u.pathname);
        }
      } catch {
        /* kein gültiger Link */
      }
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const W = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector };
        const detector = W.BarcodeDetector ? new W.BarcodeDetector({ formats: ["qr_code"] }) : null;
        const jsQR = detector ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        const ctx2d = canvas.getContext("2d", { willReadFrequently: true })!;
        const tick = async () => {
          if (stopped || !video.current) return;
          const v = video.current;
          if (v.videoWidth) {
            if (detector) {
              const codes = await detector.detect(v).catch(() => []);
              if (codes[0]) handle(codes[0].rawValue);
            } else if (jsQR) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              ctx2d.drawImage(v, 0, 0);
              const img = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height);
              if (code?.data) handle(code.data);
            }
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setError(t("qr.noCamera"));
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [router, t]);

  return (
    <div className="space-y-2">
      <video ref={video} playsInline muted className="aspect-square w-full rounded-[18px] bg-black object-cover" />
      {error && <p className="text-danger" role="alert">{error}</p>}
    </div>
  );
}
