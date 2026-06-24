import Link from "next/link";
import { ArrowLeft, CheckCircle2, Settings, Sparkles } from "lucide-react";

const steps = [
  {
    title: "打开设置",
    text: "点击右上角齿轮按钮，打开 API 设置弹窗。",
  },
  {
    title: "填写中转根域名",
    text: "IMAGE_API_URL 只填写根域名，例如 https://dahlo.live。",
  },
  {
    title: "填写 Key 和模型",
    text: "IMAGE_API_KEY 填写你的中转 Key，IMAGE_MODEL 推荐使用 gpt-image-2。",
  },
  {
    title: "保存并生成",
    text: "保存设置后回到工作台，选择文生图或图生图，输入 Prompt 后生成图片。",
  },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-ink/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-mint text-ink shadow-soft">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">
                AI Image Studio
              </p>
              <h1 className="text-base font-semibold text-white sm:text-lg">说明文档</h1>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-stone-200 transition hover:border-mint/50 hover:text-mint"
          >
            <ArrowLeft className="size-4" aria-hidden />
            返回工作台
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <section className="rounded-lg border border-white/10 bg-panel/78 p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-mint/12 text-mint">
              <Settings className="size-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">如何配置 API</h2>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                本项目通过后端 Route Handler 调用图片接口。页面里保存的 API 设置只作为本地浏览器配置使用，
                生成时会发送到本站后端，再由后端拼接完整接口并转发请求。
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {steps.map((step) => (
              <article key={step.title} className="rounded-lg border border-white/10 bg-ink/54 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 className="size-4 text-mint" aria-hidden />
                  {step.title}
                </div>
                <p className="text-sm leading-6 text-stone-400">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-panel/78 p-5 shadow-soft">
            <h2 className="text-base font-semibold text-white">正确填写方式</h2>
            <div className="mt-4 space-y-3 text-sm text-stone-300">
              <p>如果你的中转地址是 dahlo.live，设置中填写：</p>
              <pre className="overflow-auto rounded-md border border-white/10 bg-ink p-3 text-xs leading-6 text-mint">
                {`IMAGE_API_URL=https://dahlo.live
IMAGE_API_KEY=你的真实 Key
IMAGE_MODEL=gpt-image-2`}
              </pre>
              <p className="leading-6 text-stone-400">
                后端会自动调用 `https://dahlo.live/v1/images/generations`。
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-panel/78 p-5 shadow-soft">
            <h2 className="text-base font-semibold text-white">不要这样填写</h2>
            <div className="mt-4 space-y-3 text-sm text-stone-400">
              <p>不要以 `/` 结尾：</p>
              <pre className="overflow-auto rounded-md border border-coral/30 bg-coral/10 p-3 text-xs leading-6 text-rose-100">
                https://dahlo.live/
              </pre>
              <p>不要携带 `/v1` 或完整接口路径：</p>
              <pre className="overflow-auto rounded-md border border-coral/30 bg-coral/10 p-3 text-xs leading-6 text-rose-100">
                {`https://dahlo.live/v1
https://dahlo.live/v1/images/generations`}
              </pre>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-white/10 bg-panel/78 p-5 shadow-soft">
          <h2 className="text-base font-semibold text-white">如何使用</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-ink/54 p-4">
              <h3 className="text-sm font-semibold text-white">Prompt</h3>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                输入你想生成的画面描述，也可以点击示例快速填充。
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-ink/54 p-4">
              <h3 className="text-sm font-semibold text-white">分辨率</h3>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                选择 1K、2K 或 4K。分辨率越高，生成耗时和接口消耗通常越高。
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-ink/54 p-4">
              <h3 className="text-sm font-semibold text-white">图生图</h3>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                切换到图生图后上传 PNG、JPG 或 WEBP 参考图，系统会调用 `/v1/images/edits`。
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-ink/54 p-4">
              <h3 className="text-sm font-semibold text-white">结果操作</h3>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                生成后可以预览、下载、复制链接、复用参数或删除本地记录。
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
