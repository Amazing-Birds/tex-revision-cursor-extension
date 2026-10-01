# TeX Revision Markup Tools

当前版本：`0.6.1`

这是一个可在 Cursor 和 VS Code 中使用的 TeX 修订标记处理插件。它用于在论文或 LaTeX 文档中批量确认、撤销、跳转和统计修订内容。

插件默认支持：

- 新增内容：`\add{...}`
- 删除内容：`\reduce{...}`
- 始终删除的评论内容：`\comment{...}`
- 颜色块新增：`{\color{blue} ...}`
- 颜色块删除：`{\color{red} ...}`

## 安装

从 [GitHub Releases](https://github.com/Amazing-Birds/tex-revision-cursor-extension/releases) 下载最新的 `.vsix` 文件。也可以克隆仓库后按下文的“开发”章节自行打包。

### Cursor 安装

在 Cursor 中安装：

1. 打开 Cursor。
2. 打开 Extensions / 扩展面板。
3. 点击扩展面板右上角的 `...`。
4. 选择 `Install from VSIX...`。
5. 选择 `tex-revision-cursor-extension-0.6.1.vsix`。
6. 安装后运行 `Developer: Reload Window`，或重启 Cursor。

也可以在命令行运行 `cursor --install-extension <下载的VSIX文件路径>`。

### VS Code 安装

在 VS Code 中安装：

1. 打开 VS Code。
2. 打开 Extensions / 扩展面板。
3. 点击扩展面板右上角的 `...`。
4. 选择 `Install from VSIX...`。
5. 选择 `tex-revision-cursor-extension-0.6.1.vsix`。
6. 安装后运行 `Developer: Reload Window`，或重启 VS Code。

也可以在命令行运行 `code --install-extension <下载的VSIX文件路径>`。

## 使用入口

打开 `.tex` 或 `.ltx` 文件后，可以通过三种方式使用插件：

- 命令面板：按 `Ctrl + Shift + P`，搜索 `TeX Revision`。
- 编辑器右键菜单：选中文本后右键，可使用选区确认和选区撤销。
- 侧边栏面板：打开左侧 Activity Bar 中的 `TeX Revision` 视图。

如果想把插件面板放在 Cursor 右侧栏，可以打开 `TeX Revision` 视图后，将视图标题拖到 Secondary Side Bar；也可以在命令面板运行 `View: Move View`，再选择移动到右侧栏。

## 核心命令

### Accept All Changes

确认当前 TeX 文档中的所有修订：

- 保留并展开新增内容。
- 删除旧内容。
- 删除评论类内容。

示例：

```tex
\add{new}\reduce{old}\comment{note}
```

执行 Accept 后：

```tex
new
```

### Reject All Changes

撤销当前 TeX 文档中的所有修订：

- 删除新增内容。
- 保留并展开旧内容。
- 删除评论类内容。

示例：

```tex
\add{new}\reduce{old}\comment{note}
```

执行 Reject 后：

```tex
old
```

### Accept Selected Changes

只确认当前选区内完整包含的修订标记。

如果当前编辑器不是 TeX 文件，或者选区中没有完整的修订组，插件不会修改文档。

### Reject Selected Changes

只撤销当前选区内完整包含的修订标记。

如果当前编辑器不是 TeX 文件，或者选区中没有完整的修订组，插件不会修改文档。

### Show Change Count

统计当前文档中的：

- addition revisions
- removal revisions
- discard revisions

统计对象包括命令形式和颜色块形式。

### Go to Previous Change

跳转到上一个修订标记。

连续点击会继续向前跳转；到达文档开头后会回绕到文档末尾。

### Go to Next Change

跳转到下一个修订标记。

连续点击会继续向后跳转；到达文档末尾后会回绕到文档开头。

### Open Settings

打开插件设置，用于修改新增命令、删除命令、评论命令和颜色规则。

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

### 3. 评论命令

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

## Agent Instructions

插件内置了一份 Cursor Agent rule 模板，用于让 Agent 遵守 TeX 论文修订工作流。

侧边栏中包含以下按钮：

- `Enable Agent Instructions`
  - 在当前 workspace 中生成或启用 `.cursor/rules/tex-revision-agent.mdc`。
- `Disable Agent Instructions`
  - 将启用中的规则移动到 `.cursor/rules-disabled/tex-revision-agent.mdc`。
- `Edit Agent Instructions`
  - 打开当前 workspace 中的规则文件，方便修改。
- `Restore Default Agent Instructions`
  - 用插件内置模板覆盖当前 workspace 中的规则文件。

注意：插件不能直接改写 Cursor Agent 的系统提示。它采用的是 Cursor workspace rule 文件机制。启用后，生成的 `.mdc` 文件使用 `alwaysApply: true`，Cursor Agent 应该会在该 workspace 中自动使用这份规则。

## 当前内置 Agent Rule

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
