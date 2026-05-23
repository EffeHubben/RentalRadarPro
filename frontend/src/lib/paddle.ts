import { getPaddleClientToken, getPaddleEnv } from "@/lib/billing";

type PaddleInstance = {
  Checkout: {
    open: (options: Record<string, unknown>) => void;
  };
  Environment?: {
    set: (env: string) => void;
  };
};

type PaddleGlobal = PaddleInstance & {
  Initialized?: boolean;
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
    PaddleInitOptions?: Record<string, unknown>;
  }
}

const PADDLE_SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

let loadPromise: Promise<PaddleInstance> | null = null;

function loadPaddleScript(): Promise<PaddleInstance> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paddle.js can only load in the browser"));
  }

  if (window.Paddle) {
    return Promise.resolve(window.Paddle);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<PaddleInstance>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PADDLE_SCRIPT_SRC}"]`,
    );

    const onReady = () => {
      if (window.Paddle) {
        resolve(window.Paddle);
      } else {
        reject(new Error("Paddle.js loaded but Paddle global is missing"));
      }
    };

    if (existing) {
      if (window.Paddle) {
        onReady();
        return;
      }
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Paddle.js")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = PADDLE_SCRIPT_SRC;
    script.async = true;
    script.onload = onReady;
    script.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function initializePaddle(): Promise<PaddleInstance> {
  const paddle = (await loadPaddleScript()) as PaddleGlobal;
  const env = getPaddleEnv();
  const token = getPaddleClientToken();

  if (env === "sandbox" && paddle.Environment?.set) {
    paddle.Environment.set("sandbox");
  }

  if (!paddle.Initialized) {
    const initFn = (paddle as unknown as { Initialize?: (opts: Record<string, unknown>) => void })
      .Initialize;
    if (initFn && token) {
      initFn({ token });
      paddle.Initialized = true;
    }
  }

  return paddle;
}

export async function openPaddleCheckoutByTransaction(transactionId: string): Promise<void> {
  const paddle = await initializePaddle();
  paddle.Checkout.open({ transactionId });
}
