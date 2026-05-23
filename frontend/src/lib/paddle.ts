import { getPaddleClientToken, getPaddleEnv } from "@/lib/billing";

type PaddleCheckoutSettings = {
  displayMode?: "overlay" | "inline";
  theme?: "light" | "dark";
  successUrl?: string;
};

type PaddleInstance = {
  Checkout?: {
    open: (options: {
      transactionId?: string;
      settings?: PaddleCheckoutSettings;
      [key: string]: unknown;
    }) => void;
  };
  Environment?: {
    set: (env: "sandbox" | "production") => void;
  };
  Initialize?: (options: { token: string; [key: string]: unknown }) => void;
  Initialized?: boolean;
};

declare global {
  interface Window {
    Paddle?: PaddleInstance;
  }
}

const PADDLE_SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

let scriptPromise: Promise<PaddleInstance> | null = null;
let initialized = false;

export class PaddleNotConfiguredError extends Error {
  constructor() {
    super("Paddle client token is not configured (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN)");
    this.name = "PaddleNotConfiguredError";
  }
}

export class PaddleLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaddleLoadError";
  }
}

function loadPaddleScript(): Promise<PaddleInstance> {
  if (typeof window === "undefined") {
    return Promise.reject(new PaddleLoadError("Paddle.js can only load in the browser"));
  }

  if (window.Paddle) {
    return Promise.resolve(window.Paddle);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<PaddleInstance>((resolve, reject) => {
    const finishWhenReady = () => {
      if (window.Paddle) {
        resolve(window.Paddle);
      } else {
        reject(new PaddleLoadError("Paddle.js loaded but Paddle global is missing"));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PADDLE_SCRIPT_SRC}"]`,
    );

    if (existing) {
      if (window.Paddle) {
        finishWhenReady();
        return;
      }
      existing.addEventListener("load", finishWhenReady, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new PaddleLoadError("Failed to load Paddle.js")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = PADDLE_SCRIPT_SRC;
    script.async = true;
    script.onload = finishWhenReady;
    script.onerror = () => {
      scriptPromise = null;
      reject(new PaddleLoadError("Failed to load Paddle.js"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function initializePaddle(): Promise<PaddleInstance> {
  const token = getPaddleClientToken();
  if (!token) {
    throw new PaddleNotConfiguredError();
  }

  const paddle = await loadPaddleScript();

  if (initialized) {
    return paddle;
  }

  if (getPaddleEnv() === "sandbox" && paddle.Environment?.set) {
    try {
      paddle.Environment.set("sandbox");
    } catch (error) {
      console.warn("paddle.environment.set_failed", error);
    }
  }

  if (typeof paddle.Initialize !== "function") {
    throw new PaddleLoadError("Paddle.Initialize is not available on the loaded SDK");
  }

  paddle.Initialize({ token });
  paddle.Initialized = true;
  initialized = true;

  return paddle;
}

function defaultSuccessUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return `${window.location.origin}/account?billing=success`;
}

export type OpenCheckoutOptions = {
  successUrl?: string;
  theme?: "light" | "dark";
  displayMode?: "overlay" | "inline";
};

export async function openPaddleCheckout(
  transactionId: string,
  options: OpenCheckoutOptions = {},
): Promise<void> {
  const paddle = await initializePaddle();

  if (!paddle.Checkout || typeof paddle.Checkout.open !== "function") {
    throw new PaddleLoadError("Paddle.Checkout.open is not available on the loaded SDK");
  }

  paddle.Checkout.open({
    transactionId,
    settings: {
      displayMode: options.displayMode ?? "overlay",
      theme: options.theme ?? "light",
      successUrl: options.successUrl ?? defaultSuccessUrl(),
    },
  });
}
