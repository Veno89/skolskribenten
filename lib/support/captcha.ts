const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerificationResponse {
  success?: boolean;
  "error-codes"?: string[];
}

export interface SupportCaptchaVerificationResult {
  ok: boolean;
  error?: string;
  skipped?: boolean;
}

function isCaptchaRequired(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY) || (process.env.APP_ENV ?? process.env.NODE_ENV) === "production";
}

export async function verifySupportCaptcha(
  token: string | undefined,
  remoteIp?: string | null,
): Promise<SupportCaptchaVerificationResult> {
  if (!isCaptchaRequired()) {
    return { ok: true, skipped: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return {
      ok: false,
      error: "Supportformuläret saknar bot-skydd i produktion. Försök igen senare.",
    };
  }

  if (!token) {
    return {
      ok: false,
      error: "Bekräfta att du inte är en robot innan du skickar meddelandet.",
    };
  }

  const formData = new FormData();
  formData.set("secret", secret);
  formData.set("response", token);

  if (remoteIp) {
    formData.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      body: formData,
      method: "POST",
    });
    const payload = (await response.json()) as TurnstileVerificationResponse;

    if (!response.ok || !payload.success) {
      return {
        ok: false,
        error: "Bot-skyddet kunde inte verifieras. Försök igen.",
      };
    }
  } catch {
    return {
      ok: false,
      error: "Bot-skyddet kunde inte verifieras just nu. Försök igen om en stund.",
    };
  }

  return { ok: true };
}
