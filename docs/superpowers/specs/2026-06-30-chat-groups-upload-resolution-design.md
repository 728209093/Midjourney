# 聊天分组、拖拽上传与分辨率下拉设计

## 目标

把当前单一聊天页升级成“本地多会话工作台”：

1. 左侧新增聊天分组列表，支持切换、改名、置顶、删除、新建。
2. 聊天标题默认由首句生成，后续可手动修改。
3. 每个聊天独立保存对话记录、草稿和生成参数。
4. PC 端支持拖拽图片作为参考图上传。
5. 将分辨率选择改为输入区内的下拉框。
6. 设置页删除重复的参数块，只保留真正的 API 配置与少量高级项。
7. 参考图地址不可访问时，保留当前草稿，并给出可恢复的失败提示。

## 范围

### 做

- 本地会话管理
- 侧边栏会话列表
- 会话标题自动生成与手动重命名
- 置顶与删除
- 会话级参数持久化
- 参考图拖拽上传
- 分辨率下拉
- 设置页瘦身
- 生成失败时的友好恢复提示

### 不做

- 服务器端账号体系
- 云同步
- 聊天搜索
- 多级分组树
- 协同编辑

## 现状

当前页面已经有：

- `CHAT_STORE_KEY` 的本地会话骨架
- `sessionId` 与 `turns`
- 参考图上传
- 比例选择
- 分辨率状态
- `SettingsDialog`

所以这次不是重做架构，而是在现有单页上补齐会话管理层。

## 交互设计

### 左侧聊天分组

- 左侧固定栏展示全部会话。
- 排序规则：置顶在前，其余按最近更新时间倒序。
- 每个会话显示标题、最近更新时间、简短状态。
- 点击切换会话。
- 新建会话会立刻成为当前会话。
- 删除会话时，若删的是当前会话，则自动切到下一条可用会话；没有则新建空会话。

### 标题规则

- 首次提交生成时，从 prompt 首句截取标题。
- 标题过长时截断。
- 如果用户手动改过标题，后续不再自动覆盖。
- 改名采用内联编辑，回车保存，Esc 取消。

### 会话级状态

每个会话独立保存：

- turns
- prompt 草稿
- aspect ratio
- resolution
- count
- reference image file / source / preview 状态
- reference action

切换会话时，界面恢复该会话的全部状态。

### 参考图上传

- 保留点击选择文件。
- PC 端额外支持拖拽到参考图区域。
- 拖拽时高亮边框。
- 松手后仅接收图片文件。
- 非图片文件直接忽略并给出轻量提示。

### 分辨率下拉

- 在聊天输入区下方放一个分辨率下拉。
- 对用户只显示 `1K / 2K / 4K`。
- 如果底层接口存在内部别名映射，放在请求层处理，不暴露给用户。

### 设置页清理

- 删除重复的尺寸、分辨率、数量块。
- 设置页只保留 API URL、API Key、模型等真正全局配置。
- 会话级参数只在聊天区修改。

## 数据模型

### 本地存储

继续用 localStorage，避免引入额外存储复杂度。

建议结构：

```ts
type ChatStore = {
  activeSessionId: string;
  sessions: ChatSession[];
};

type ChatSession = {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  turns: PersistedChatTurn[];
  draft: {
    prompt: string;
    size: ImageSize;
    resolution: ImageResolution;
    quality: ImageQuality;
    count: number;
    referenceImageSource: string;
    referenceImageMeta: {
      name?: string;
      type?: string;
    } | null;
    referenceAction: "attach" | "replace";
  };
  titleEdited?: boolean;
};
```

### 兼容迁移

- 旧的 `CHAT_STORE_KEY` 仍然可读。
- 如果只存在旧的扁平 `turns` 历史，启动时自动迁成一个默认会话。
- `HISTORY_KEY` 作为更早版本的兜底读取。

## 生成与错误处理

- 生成失败时，当前草稿不清空。
- 如果是参考图地址暂时不可访问，提示用户重试或重新上传。
- 如果是拖拽/文件读取失败，保留原参考图状态。
- 如果本地恢复图片失败，继续保留文字记录，不阻断整个会话。

## 实现边界

### 推荐落点

- `app/page.tsx`：状态主控与布局切换
- `components/Header.tsx`：补充会话相关入口或精简按钮
- `components/SettingsDialog.tsx`：移除重复参数块
- `components/ReferenceImageInput.tsx`：拖拽上传
- `components/ImageSettings.tsx` 或 `app/page.tsx`：分辨率下拉
- 新增会话侧边栏组件：负责列表、置顶、重命名、删除

### 状态流

1. 启动时读取本地会话存储。
2. 恢复 active session 的 turns 和 draft。
3. 切换会话时，先写回当前会话，再加载目标会话。
4. 发送消息时，先创建 turn，再生成图片，成功后更新会话标题和更新时间。
5. 所有修改都落回 localStorage。

## 验收标准

- 能创建多个本地聊天。
- 能切换、改名、置顶、删除聊天。
- 切换后能继续当前聊天历史。
- 每个聊天的比例、分辨率、数量、参考图能单独记住。
- 参考图支持拖拽上传。
- 分辨率下拉可用，设置页不再重复展示这些参数。
- 参考图网络失败时提示清晰，草稿不丢。

## 测试建议

- 新建、切换、删除会话的状态恢复测试
- 标题首句生成与手动改名测试
- localStorage 迁移测试
- 拖拽上传图片测试
- 参考图 URL 失效的错误提示测试
- 分辨率下拉保存与恢复测试

