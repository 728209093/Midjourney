"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { ApiSettings } from "@/components/ApiSettings";
import type { ImageApiConfig } from "@/types/image";

type SettingsDialogProps = {
  open: boolean;
  apiConfig: ImageApiConfig;
  message: { text: string; tone: "success" | "error" | "info" } | null;
  disabled?: boolean;
  children?: ReactNode;
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
  children,
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
      className="fixed inset-0 z-50 overflow-y-auto bg-black/78 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
      onClick={onClose}
    >
      <div
        className="mx-auto flex min-h-full w-full max-w-4xl items-stretch px-0 sm:items-center sm:px-4 sm:py-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-ink/96 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg sm:border sm:border-white/10 sm:shadow-soft">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md border border-white/10 bg-ink/80 text-stone-300 transition hover:border-mint/50 hover:text-mint"
            title="关闭"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">关闭</span>
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-14 sm:px-6 sm:pb-6 sm:pt-12">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <div className="min-w-0">{children}</div>

              <ApiSettings
                value={apiConfig}
                onChange={onApiConfigChange}
                onSave={onSave}
                onReset={onReset}
                disabled={disabled}
              />
            </div>

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
