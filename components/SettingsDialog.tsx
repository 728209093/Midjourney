"use client";

import { X } from "lucide-react";

import { ApiSettings } from "@/components/ApiSettings";
import type { ImageApiConfig } from "@/types/image";

type SettingsDialogProps = {
  open: boolean;
  apiConfig: ImageApiConfig;
  message: { text: string; tone: "success" | "error" | "info" } | null;
  disabled?: boolean;
  onApiConfigChange: (value: ImageApiConfig) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
};

export function SettingsDialog({
  open,
  apiConfig,
  message,
  disabled,
  onApiConfigChange,
  onSave,
  onReset,
  onClose,
}: SettingsDialogProps) {
  if (!open) {
    return null;
  }

  const messageClassName =
    message?.tone === "error"
      ? "border-coral/70 bg-coral/[0.16] text-coral shadow-[0_0_0_1px_rgba(251,113,133,0.16)]"
      : message?.tone === "success"
        ? "border-mint/40 bg-mint/[0.12] text-mint"
        : "border-gold/45 bg-gold/[0.12] text-gold";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/78 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      onClick={onClose}
    >
      <div className="relative w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
        <div className="max-h-[calc(100vh-1rem)] overflow-hidden rounded-t-2xl border border-white/10 bg-panel/92 shadow-soft sm:max-h-[calc(100vh-2rem)] sm:rounded-lg">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md border border-white/10 bg-ink/80 text-stone-300 transition hover:border-mint/50 hover:text-mint"
            title="关闭"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">关闭</span>
          </button>

          <div className="max-h-[calc(100vh-1rem)] overflow-y-auto p-4 sm:max-h-[calc(100vh-2rem)]">
            <ApiSettings
              value={apiConfig}
              onChange={onApiConfigChange}
              onSave={onSave}
              onReset={onReset}
              disabled={disabled}
            />

            {message ? (
              <p
                className={`mt-3 rounded-md border px-3 py-2.5 text-sm font-medium ${messageClassName}`}
                role="alert"
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
