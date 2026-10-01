# TeX Revision Markup Tools

当前版本：`0.6.1`

**在 Cursor 和 VS Code 中，逐处审阅并接受或拒绝 TeX 文档的修订。**

TeX Revision Markup Tools 适用于论文写作、AI 辅助修改和多人协作场景。它识别文档中的新增、删除和批注标记，支持修订跳转、数量统计、选区处理和全文批量处理，方便作者决定保留哪些修改。

使用前，需由作者或 AI 在文档中写入下列修订标记；插件负责处理已有标记，不会自动比较文件版本并生成差异。

插件默认支持：

- 新增内容：`\add{...}`
- 删除内容：`\reduce{...}`
- 批注内容（接受或拒绝时均删除）：`\comment{...}`
- 颜色块新增：`{\color{blue} ...}`
- 颜色块删除：`{\color{red} ...}`

## 安装

从 [GitHub Releases](https://github.com/Amazing-Birds/tex-revision-cursor-extension/releases) 下载最新的 `.vsix` 文件。也可以克隆仓库后按下文的“开发”章节自行打包。

### 在 Cursor / VS Code 中安装

1. 打开 Cursor 或 VS Code。
2. 打开 Extensions / 扩展面板。
3. 点击扩展面板右上角的 `...`。
4. 选择 `Install from VSIX...`。
5. 选择下载的 `.vsix` 文件，例如 `tex-revision-cursor-extension-0.6.1.vsix`。
6. 安装后运行 `Developer: Reload Window`，或重启编辑器。

也可以通过命令行安装，将下方路径替换为实际下载位置：

```powershell
# Cursor
cursor --install-extension "path/to/tex-revision-cursor-extension-0.6.1.vsix"

# VS Code
code --install-extension "path/to/tex-revision-cursor-extension-0.6.1.vsix"
```

## 使用入口

打开 TeX 文档后，可以通过以下入口使用插件：

- 命令面板：按 `Ctrl + Shift + P`，搜索 `TeX Revision`。
- 编辑器右键菜单：在 `.tex` 文件中选中文本后右键，可接受或拒绝选区中的修订。
- 侧边栏面板：打开左侧 Activity Bar 中的 `TeX Revision` 视图。

如果想把插件面板放在 Cursor 右侧栏，可以打开 `TeX Revision` 视图后，将视图标题拖到 Secondary Side Bar；也可以在命令面板运行 `View: Move View`，再选择移动到右侧栏。

### 逐处审阅

1. 打开包含修订标记的文档和 `TeX Revision` 侧边栏。
2. 点击 `Go to Next Change` 或 `Go to Previous Change`，跳转并选中一个完整的修订标记。
3. 核查内容后，点击 `Accept Selected Changes` 接受该修订，或点击 `Reject Selected Changes` 拒绝该修订。
4. 重复以上操作；如需统一处理全文，可使用 `Accept All Changes` 或 `Reject All Changes`。

若一次替换由相邻的删除标记和新增标记组成，请同时选中两者，再执行选区操作。

## 核心命令

### Accept All Changes

接受当前 TeX 文档中的所有修订：

- 保留并展开新增内容。
- 删除旧内容。
- 删除批注内容。

示例：

```tex
\add{new}\reduce{old}\comment{note}
```

执行 Accept 后：

```tex
new
```

### Reject All Changes

拒绝当前 TeX 文档中的所有修订：

- 删除新增内容。
- 保留并展开旧内容。
- 删除批注内容。

示例：

```tex
\add{new}\reduce{old}\comment{note}
```

执行 Reject 后：

```tex
old
```

### Accept Selected Changes

只接受当前选区内完整包含的修订标记。

如果当前编辑器不是 TeX 文件，或者选区中没有完整的修订组，插件不会修改文档。

### Reject Selected Changes

只拒绝当前选区内完整包含的修订标记。

如果当前编辑器不是 TeX 文件，或者选区中没有完整的修订组，插件不会修改文档。

### Show Change Count

统计当前文档中的：

- 新增修订（addition）
- 删除修订（removal）
- 接受或拒绝时均会删除的批注（discard）

统计对象包括命令形式和颜色块形式。

### Go to Previous Change

跳转到上一个修订标记。

连续点击会继续向前跳转；到达文档开头后会回绕到文档末尾。

### Go to Next Change

跳转到下一个修订标记。

连续点击会继续向后跳转；到达文档末尾后会回绕到文档开头。

### Open Settings

打开插件设置，自定义新增命令、删除命令、批注命令和颜色规则。

## 支持的修订格式

### 1. 新增命令

默认：

```tex
\add{new text}
```

Accept 后：

```tex
new text
```

Reject 后删除整个命令组。

### 2. 删除命令

默认：

```tex
\reduce{old text}
```

Accept 后删除整个命令组。

Reject 后：

```tex
old text
```

### 3. 批注命令

默认：

```tex
\comment{internal note}
```

Accept 和 Reject 都会删除整个命令组。

### 4. 颜色块新增

默认：

```tex
{\color{blue}
new text
}
```

Accept 后：

```tex
new text
```

Reject 后删除整个颜色块。

### 5. 颜色块删除

默认：

```tex
{\color{red}
old text
}
```

Accept 后删除整个颜色块。

Reject 后：

```tex
old text
```

## 空行处理

从 `0.6.1` 开始，如果被删除的修订组独占一行，插件会连同这一行的换行一起删除，避免在 LaTeX 环境或行间公式中留下空行。

示例：

```tex
before
{\color{red}
old text
}
after
```

Accept 后：

```tex
before
after
```

不会变成：

```tex
before

after
```

如果修订是行内内容，插件只删除对应的修订组，不会删除整行。

## 配置

可以在 Cursor / VS Code 的 Settings 中搜索 `TeX Revision` 修改配置，也可以直接编辑 `settings.json`。

### 推荐配置项

```json
{
  "texRevision.addCommands": [
    "\\add"
  ],
  "texRevision.reduceCommands": [
    "\\reduce"
  ],
  "texRevision.discardCommands": [
    "\\comment"
  ],
  "texRevision.addColors": [
    "blue"
  ],
  "texRevision.reduceColors": [
    "red"
  ]
}
```

### 增加多个新增命令

```json
{
  "texRevision.addCommands": [
    "\\add",
    "\\DIFadd",
    "\\blue"
  ]
}
```

这些命令都会按新增内容处理：

- Accept：展开正文。
- Reject：整段删除。

### 增加多个删除命令

```json
{
  "texRevision.reduceCommands": [
    "\\reduce",
    "\\DIFdel",
    "\\red"
  ]
}
```

这些命令都会按删除内容处理：

- Accept：整段删除。
- Reject：展开正文。

### 增加多个始终删除命令

```json
{
  "texRevision.discardCommands": [
    "\\comment",
    "\\todo",
    "\\note"
  ]
}
```

这些命令在 Accept 和 Reject 中都会被删除。

### 自定义颜色块

```json
{
  "texRevision.addColors": [
    "blue",
    "cyan"
  ],
  "texRevision.reduceColors": [
    "red",
    "magenta"
  ]
}
```

这样插件会把 `{\color{cyan} ...}` 也当作新增，把 `{\color{magenta} ...}` 也当作删除。

### 旧配置兼容

插件仍兼容旧版单命令配置：

```json
{
  "texRevision.addCommand": "\\add",
  "texRevision.reduceCommand": "\\reduce"
}
```

但新项目建议使用数组形式：

```json
{
  "texRevision.addCommands": [
    "\\add"
  ],
  "texRevision.reduceCommands": [
    "\\reduce"
  ]
}
```

## latexdiff 配置示例

如果文档使用 latexdiff 风格命令，可以配置为：

```json
{
  "texRevision.addCommands": [
    "\\add",
    "\\DIFadd"
  ],
  "texRevision.reduceCommands": [
    "\\reduce",
    "\\DIFdel"
  ],
  "texRevision.discardCommands": [
    "\\comment",
    "\\todo"
  ],
  "texRevision.addColors": [
    "blue"
  ],
  "texRevision.reduceColors": [
    "red"
  ]
}
```

## Agent Instructions（Cursor 智能体规则）

插件内置了一份 Cursor Agent 规则模板，用于约定 TeX 论文的修订方式，提示 Agent 保留可见的新增与删除标记，供作者审阅。

侧边栏中包含以下按钮：

- `Enable Agent Instructions`
  - 在当前工作区中生成或启用 `.cursor/rules/tex-revision-agent.mdc`。
- `Disable Agent Instructions`
  - 将启用中的规则移动到 `.cursor/rules-disabled/tex-revision-agent.mdc`。
- `Edit Agent Instructions`
  - 打开当前工作区中的规则文件，方便修改。
- `Restore Default Agent Instructions`
  - 用插件内置模板覆盖当前工作区中的规则文件。

此功能使用 Cursor 的工作区规则机制，生成的 `.mdc` 文件包含 `alwaysApply: true`，供 Cursor Agent 加载。使用 Codex 等其他 AI 工具时，请在对应工具中配置相应的修订要求。

### 默认规则内容

插件默认生成的规则文件是：

```text
.cursor/rules/tex-revision-agent.mdc
```

它主要要求 Agent：

- 对实质性论文修改先给出修改计划。
- 修改 TeX 文稿时保留可见修订标记。
- 明确新增和删除内容。
- 用户确认接受后再清理修订标记。
- 不静默删除修订内容。

用户可以通过 `Edit Agent Instructions` 直接编辑这份规则。

## 开发

克隆仓库后，在项目根目录运行以下命令。

运行测试：

```powershell
npm test
```

当前测试覆盖：

- accept / reject 基础行为
- 多个新增命令
- 多个删除命令
- 始终删除命令
- 颜色块新增 / 删除
- 多行颜色块
- 独占行删除时不保留空行
- 上一个 / 下一个修订跳转
- 不完整命令忽略
- 相似命令名避免误匹配

打包 VSIX：

```powershell
npx @vscode/vsce package
```

## 限制

- 选区命令只处理完整包含在选区中的修订组。
- 解析器会平衡花括号，并跳过 `\{`、`\}` 这类转义字符。
- 插件不会执行完整 TeX 宏展开。
- 颜色块支持显式分组形式，例如 `{\color{red} ...}` 和 `{\color{blue} ...}`。
- `% 修改说明：...` 这类 LaTeX 注释不会被 Accept 或 Reject 删除，因为它们不会出现在 PDF 中。
