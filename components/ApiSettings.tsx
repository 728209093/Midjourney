"use client";

import { KeyRound, RotateCcw, Save, ServerCog } from "lucide-react";
import { useState } from "react";

import type { ImageApiConfig } from "@/types/image";

type ApiSettingsProps = {
  value: ImageApiConfig;
  onChange: (value: ImageApiConfig) => void;
  onSave: () => void;
  onReset: () => void;
  disabled?: boolean;
};

export function ApiSettings({
  value,
  onChange,
  onSave,
  onReset,
  disabled,
}: ApiSettingsProps) {
  const [showKey, setShowKey] = useState(false);

  function updateField(field: keyof ImageApiConfig, nextValue: string) {
    onChange({
      ...value,
      [field]: nextValue,
    });
  }

  return (
    <section id="settings" className="rounded-lg border border-white/10 bg-panel/86 p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">API 设置</h2>
          <p className="mt-1 text-xs text-stone-400">保存在当前浏览器</p>
        </div>
        <div className="grid size-9 place-items-center rounded-md bg-white/[0.06] text-mint">
          <ServerCog className="size-4" aria-hidden />
        </div>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-stone-300">IMAGE_API_URL</span>
          <input
            type="url"
            value="https://dahlo.live"
            disabled
            className="h-11 w-full cursor-not-allowed rounded-md border border-white/10 bg-ink px-3 text-sm text-stone-400 opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium text-stone-300">
            <KeyRound className="size-3.5 text-gold" aria-hidden />
            IMAGE_API_KEY
          </span>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={value.apiKey}
              onChange={(event) => updateField("apiKey", event.target.value)}
              disabled={disabled}
              placeholder="sk-..."
              className="h-11 min-w-0 flex-1 rounded-md border border-white/10 bg-ink px-3 text-sm text-white transition placeholder:text-stone-600 focus:border-mint disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowKey((current) => !current)}
              disabled={disabled}
              className="h-11 rounded-md border border-white/10 px-3 text-xs text-stone-300 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-60"
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium text-stone-300">IMAGE_MODEL</span>
          <input
            type="text"
            value={value.model}
            onChange={(event) => updateField("model", event.target.value)}
            disabled={disabled}
            placeholder="gpt-image-2"
            className="h-11 w-full rounded-md border border-white/10 bg-ink px-3 text-sm text-white transition placeholder:text-stone-600 focus:border-mint disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={disabled}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-mint/40 bg-mint/12 px-3 text-sm font-medium text-mint transition hover:bg-mint hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-4" aria-hidden />
            保存
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-medium text-stone-300 transition hover:border-coral/60 hover:text-coral disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="size-4" aria-hidden />
            清除
          </button>
        </div>

        <p className="text-xs leading-5 text-stone-500">
          只填写根域名，例如 `https://dahlo.live`。不要携带 `/v1`，也不要以 `/` 结尾。
        </p>
      </div>
    </section>
  );
}
