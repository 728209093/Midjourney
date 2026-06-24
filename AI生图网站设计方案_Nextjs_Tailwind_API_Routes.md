# AI 生图网站设计方案

技术栈：**Next.js + Tailwind CSS + API Routes**

目标：使用你已有的 `gpt-images-2` API URL 和 API Key，开发一个安全、可扩展的 AI 生图网站。用户在网页输入提示词后，网站通过后端 API Route 调用图片生成接口，并在前端展示生成结果。

---

## 1. 项目定位

### 1.1 网站名称示例

```txt
AI Image Studio
```

### 1.2 核心目标

用户可以在网页中输入图片描述，选择尺寸、质量、数量等参数，然后点击生成按钮，系统调用 `gpt-images-2` 接口生成图片，并将结果展示在页面中。

### 1.3 核心功能

```txt
输入 Prompt
选择图片尺寸
选择图片质量
选择生成数量
调用后端 API
展示生成结果
下载图片
保存历史记录
```

---

## 2. 技术选型

### 2.1 前端

```txt
Next.js App Router
React
Tailwind CSS
TypeScript
```

用途：

```txt
页面渲染
用户交互
表单输入
图片展示
响应式布局
```

### 2.2 后端

```txt
Next.js API Routes / Route Handlers
```

用途：

```txt
隐藏 API Key
校验请求参数
调用 gpt-images-2 API
统一格式化返回数据
处理错误信息
```

### 2.3 可选扩展技术

后期可根据业务需求增加：

```txt
Prisma + PostgreSQL：用户数据和生成记录
Redis / Upstash：接口限流
Clerk / NextAuth：登录注册
S3 / Cloudflare R2 / 阿里云 OSS：图片存储
Stripe / Lemon Squeezy：支付系统
```

---

## 3. 整体架构设计

```txt
用户浏览器
   |
   | 输入 prompt、尺寸、数量、质量
   v
Next.js 前端页面
   |
   | fetch('/api/generate-image')
   v
Next.js API Route
   |
   | 使用服务端环境变量读取 API_URL 和 API_KEY
   v
gpt-images-2 API
   |
   | 返回图片 URL 或 base64
   v
Next.js API Route
   |
   | 统一格式化返回结果
   v
前端展示图片
```

### 3.1 架构原则

```txt
前端不直接接触 API Key
所有模型调用都经过后端 API Route
后端统一做参数校验和错误处理
前端只负责 UI 和交互
```

---

## 4. 页面设计

### 4.1 首页 `/`

首页是核心生图工作台。

页面包含：

```txt
顶部导航栏
左侧参数控制面板
右侧图片结果展示区
底部说明区域
```

### 4.2 页面结构

```txt
顶部导航栏
  - Logo
  - 产品名称
  - 生成图片
  - 历史记录
  - 设置

主内容区
  左侧：Prompt 输入与参数配置
  右侧：图片生成结果展示

底部
  - 版权信息
  - 使用说明
```

### 4.3 页面布局示意

```txt
┌──────────────────────────────────────────────┐
│ AI Image Studio                    Settings  │
├──────────────────────────────────────────────┤
│                                              │
│  ┌───────────────┐   ┌────────────────────┐ │
│  │ Prompt 输入区 │   │                    │ │
│  │               │   │   图片生成结果区    │ │
│  │ 图片比例       │   │                    │ │
│  │ 图片数量       │   │                    │ │
│  │ 图片质量       │   │                    │ │
│  │ 生成按钮       │   │                    │ │
│  └───────────────┘   └────────────────────┘ │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 5. 功能模块设计

## 5.1 Prompt 输入模块

用户输入想生成的图片描述。

### 字段

```ts
type PromptInput = {
  prompt: string;
};
```

### 示例 Prompt

```txt
一只穿宇航服的橘猫，站在月球表面，电影级光影，超高清，真实摄影风格
```

### 前端交互

```txt
支持多行输入
显示字数统计
支持清空输入
支持示例 Prompt 快捷填充
后期可增加提示词优化按钮
```

---

## 5.2 图片参数模块

用户可选择生成图片的基础参数。

### 参数类型

```ts
type ImageGenerateParams = {
  prompt: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  quality: "low" | "medium" | "high";
  n: number;
};
```

### 默认参数

```txt
size: 1024x1024
quality: medium
n: 1
```

### 参数说明

```txt
size：图片尺寸
quality：图片质量
n：生成数量
prompt：用户输入的图片描述
```

---

## 5.3 图片生成模块

点击生成按钮后的流程：

```txt
1. 校验 prompt 是否为空
2. 校验参数是否合法
3. 设置 loading 状态
4. 调用 /api/generate-image
5. 等待模型返回结果
6. 展示图片
7. 保存到本地历史记录或数据库
8. 结束 loading 状态
```

---

## 5.4 图片展示模块

图片生成完成后，在右侧展示结果。

### 支持操作

```txt
图片预览
图片下载
复制图片链接
查看大图
重新生成
删除记录
```

### 图片结果数据结构

```ts
type GeneratedImage = {
  id: string;
  url?: string;
  base64?: string;
  prompt: string;
  size: string;
  quality: string;
  createdAt: string;
};
```

---

## 5.5 历史记录模块

第一版可以先使用浏览器 `localStorage` 保存历史记录。

### 本地存储结构

```ts
type ImageHistoryItem = {
  id: string;
  prompt: string;
  imageUrl: string;
  size: string;
  quality: string;
  createdAt: string;
};
```

### 后期升级

如果后续增加用户登录，可以将历史记录保存到数据库。

---

## 6. API 路由设计

## 6.1 生图接口

```txt
POST /api/generate-image
```

### 请求参数

```json
{
  "prompt": "一只穿宇航服的猫",
  "size": "1024x1024",
  "quality": "medium",
  "n": 1
}
```

### 返回参数：图片 URL 模式

```json
{
  "success": true,
  "images": [
    {
      "url": "https://example.com/image.png"
    }
  ]
}
```

### 返回参数：base64 模式

```json
{
  "success": true,
  "images": [
    {
      "base64": "iVBORw0KGgoAAAANSUhEUg..."
    }
  ]
}
```

### 错误返回

```json
{
  "success": false,
  "message": "图片生成失败，请稍后重试"
}
```

---

## 7. 环境变量设计

不要把 Key 写死在前端代码里。

项目根目录创建：

```txt
.env.local
```

内容：

```env
IMAGE_API_URL=https://your-api-url.com/v1/images/generations
IMAGE_API_KEY=your_api_key_here
IMAGE_MODEL=gpt-images-2
```

### 注意事项

```txt
.env.local 不要提交到 Git
API Key 只能在服务端读取
前端不能使用 NEXT_PUBLIC_ 前缀暴露 Key
```

---

## 8. 目录结构设计

推荐使用 Next.js App Router。

```txt
ai-image-studio/
├── app/
│   ├── api/
│   │   └── generate-image/
│   │       └── route.ts
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── Header.tsx
│   ├── PromptInput.tsx
│   ├── ImageSettings.tsx
│   ├── GenerateButton.tsx
│   ├── ImageGallery.tsx
│   ├── ImageCard.tsx
│   ├── LoadingState.tsx
│   └── EmptyState.tsx
│
├── lib/
│   ├── image-api.ts
│   ├── validators.ts
│   └── utils.ts
│
├── types/
│   └── image.ts
│
├── public/
│   └── logo.png
│
├── .env.local
├── package.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 9. 前端组件设计

## 9.1 Header

顶部导航组件。

包含：

```txt
Logo
产品名
历史记录入口
设置入口
```

---

## 9.2 PromptInput

负责提示词输入。

功能：

```txt
多行输入
字数统计
清空按钮
示例提示词
```

---

## 9.3 ImageSettings

负责生成参数设置。

包含：

```txt
图片尺寸
生成数量
质量等级
风格选择，后期可选
```

---

## 9.4 GenerateButton

负责触发图片生成。

状态设计：

```txt
默认：生成图片
加载中：正在生成...
禁用：prompt 为空或请求中
```

---

## 9.5 ImageGallery

负责展示生成结果。

包含：

```txt
图片网格
空状态
加载状态
错误状态
```

---

## 9.6 ImageCard

单张图片卡片。

操作：

```txt
下载图片
复制链接
查看大图
重新生成
删除图片
```

---

## 10. 状态管理设计

第一版不需要复杂状态管理，直接使用 React `useState` 即可。

### 核心状态

```ts
const [prompt, setPrompt] = useState("");
const [size, setSize] = useState("1024x1024");
const [quality, setQuality] = useState("medium");
const [count, setCount] = useState(1);
const [images, setImages] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
```

### 后期可选状态管理

```txt
Zustand
Redux Toolkit
Jotai
```

---

## 11. UI 风格设计

推荐做成现代 AI 工具网站风格。

### 风格关键词

```txt
简洁
暗色模式
卡片布局
大圆角
柔和阴影
渐变按钮
响应式设计
```

### 推荐主色

```txt
背景色：#0F172A
卡片色：#111827
主色：#6366F1
强调色：#8B5CF6
文字色：#F8FAFC
辅助文字：#94A3B8
```

### Tailwind 风格示例

```txt
min-h-screen bg-slate-950 text-white
rounded-2xl border border-slate-800 bg-slate-900/60
bg-gradient-to-r from-indigo-500 to-purple-500
```

---

## 12. 用户流程设计

### 12.1 基础流程

```txt
进入网站
   ↓
输入 prompt
   ↓
选择尺寸 / 数量 / 质量
   ↓
点击生成
   ↓
展示 loading
   ↓
返回图片
   ↓
用户下载或保存
```

### 12.2 异常流程

```txt
prompt 为空
   ↓
提示：请输入图片描述

API Key 错误
   ↓
提示：服务配置错误，请联系管理员

接口超时
   ↓
提示：生成时间较长，请稍后重试

内容不合规
   ↓
提示：当前提示词无法生成，请修改描述
```

---

## 13. 安全设计

## 13.1 API Key 保护

API Key 不能出现在前端代码中。

正确做法：

```txt
app/api/generate-image/route.ts 读取 process.env.IMAGE_API_KEY
```

错误做法：

```txt
在 page.tsx 或前端组件里写死 API Key
使用 NEXT_PUBLIC_IMAGE_API_KEY
```

---

## 13.2 请求限制

防止别人恶意刷接口。

第一版可以做简单限制：

```txt
同一个 IP 每分钟最多 5 次
```

后期可接入：

```txt
Upstash Redis
Cloudflare Turnstile
用户登录 + 积分系统
```

---

## 13.3 参数校验

后端必须校验：

```txt
prompt 不能为空
prompt 长度不能超过限制
size 只能是白名单
quality 只能是白名单
n 不能超过限制
```

---

## 14. MVP 版本功能范围

第一版建议只做核心功能，不要过早复杂化。

### 必须实现

```txt
首页
Prompt 输入
尺寸选择
质量选择
生成按钮
API Route
调用 gpt-images-2 API
图片展示
图片下载
loading 状态
错误提示
```

### 暂时不做

```txt
登录
支付
积分
数据库
团队空间
高级图像编辑
复杂后台管理
```

---

## 15. 后期商业化扩展设计

如果后面要做成收费网站，可以逐步增加以下模块。

### 15.1 用户系统

```txt
登录 / 注册
用户资料
生成历史
积分余额
```

### 15.2 积分系统

```txt
每生成 1 张图片消耗一定积分
新用户注册送积分
每日免费次数
失败请求不扣积分
```

### 15.3 订单系统

```txt
套餐购买
支付记录
积分充值
会员等级
```

### 15.4 管理后台

```txt
用户管理
生成记录
接口消耗统计
异常日志
模型配置
充值记录
```

---

## 16. 数据库设计，后期版本

第一版可以不接数据库。后期需要登录和历史记录时再添加。

### 16.1 users 表

```ts
type User = {
  id: string;
  email: string;
  name?: string;
  credits: number;
  createdAt: Date;
};
```

### 16.2 generations 表

```ts
type Generation = {
  id: string;
  userId: string;
  prompt: string;
  imageUrl: string;
  model: string;
  size: string;
  quality: string;
  costCredits: number;
  createdAt: Date;
};
```

### 16.3 payments 表

```ts
type Payment = {
  id: string;
  userId: string;
  amount: number;
  credits: number;
  status: "pending" | "paid" | "failed";
  createdAt: Date;
};
```

---

## 17. 推荐开发顺序

```txt
1. 创建 Next.js 项目
2. 配置 Tailwind CSS
3. 完成首页 UI
4. 完成 Prompt 输入组件
5. 完成参数选择组件
6. 创建 /api/generate-image
7. 接入 gpt-images-2 API
8. 前端调用 API
9. 展示生成图片
10. 加 loading 和错误处理
11. 加下载按钮
12. 加 localStorage 历史记录
13. 部署到 Vercel 或自己的服务器
```

---

## 18. 第一版页面模块优先级

### 必须有

```txt
Prompt 输入框
生成按钮
图片展示区
API Route
环境变量
错误提示
loading 状态
```

### 建议有

```txt
图片尺寸选择
质量选择
下载按钮
历史记录
示例提示词
```

### 后面再做

```txt
登录
积分
支付
后台
多模型切换
图片编辑
```

---

## 19. 部署方案

### 19.1 推荐部署方式

```txt
Vercel
```

适合 Next.js 项目，部署简单。

### 19.2 部署前检查

```txt
.env.local 已配置
线上环境变量已配置
API Key 未提交到 Git
接口能正常访问
图片能正常展示
错误提示正常
```

### 19.3 线上环境变量

需要在部署平台中配置：

```env
IMAGE_API_URL=https://your-api-url.com/v1/images/generations
IMAGE_API_KEY=your_api_key_here
IMAGE_MODEL=gpt-images-2
```

---

## 20. 项目最终效果

第一版完成后，网站应实现：

```txt
用户输入一句图片描述
点击生成
等待几秒到几十秒
右侧展示 AI 生成图片
用户可以下载图片
API Key 不会暴露
项目可以部署上线给别人使用
```

---

## 21. 最终推荐方案总结

推荐使用：

```txt
Next.js App Router
Tailwind CSS
API Route
.env.local 存储 Key
localStorage 存储历史记录
```

第一版重点是跑通核心链路：

```txt
输入 Prompt → 调用 API → 返回图片 → 页面展示 → 下载图片
```

等 MVP 稳定后，再加：

```txt
登录系统
积分系统
数据库
支付系统
后台管理
```

这样开发风险最低，上线速度最快，也方便后续商业化扩展。
