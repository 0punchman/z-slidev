#!/usr/bin/env node
// Translate Slidev's built-in UI strings to Simplified Chinese.
//
// Run this once after (re)installing @slidev/cli to localize buttons, tooltips,
// dialog labels, etc. Idempotent — safe to re-run; already-translated strings
// are skipped via per-file string-pair matching.
//
//   node scripts/zh-cn-patch.mjs
//
// Affects only files inside this runtime's node_modules/@slidev/client.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLIENT = resolve(__dirname, '../node_modules/@slidev/client')

/** @type {Record<string, Array<[string, string]>>} */
const patches = {
  'internals/NavControls.vue': [
    [":title=\"isFullscreen ? 'Close fullscreen' : 'Enter fullscreen'\"", ":title=\"isFullscreen ? '退出全屏' : '进入全屏'\""],
    ['title="Go to previous slide"', 'title="上一页"'],
    ['title="Go to next slide"', 'title="下一页"'],
    ['title="Show slide overview"', 'title="幻灯片概览"'],
    ["'Switch to light mode theme'", "'切换到浅色主题'"],
    ["'Switch to dark mode theme'", "'切换到深色主题'"],
    ["'Disable laser pointer'", "'关闭激光笔'"],
    ["'Enable laser pointer'", "'启用激光笔'"],
    ["'Hide presenter cursor'", "'隐藏演讲者光标'"],
    ["'Show presenter cursor'", "'显示演讲者光标'"],
    ["'Hide drawing toolbar'", "'隐藏画笔工具栏'"],
    ["'Show drawing toolbar'", "'显示画笔工具栏'"],
    ['title="Play Mode"', 'title="演讲模式"'],
    ['title="Presenter Mode"', 'title="演讲者模式"'],
    ["'Hide editor'", "'隐藏编辑器'"],
    ["'Show editor'", "'显示编辑器'"],
    ['title="Download as PDF"', 'title="导出为 PDF"'],
    ['title="Browser Exporter"', 'title="浏览器导出"'],
    ['title="Show info"', 'title="演示信息"'],
    ['title="Toggle Presenter Layout"', 'title="切换演讲者布局"'],
    ['title="More Options"', 'title="更多选项"'],
  ],

  'setup/context-menu.ts': [
    ["label: 'Previous Click'", "label: '上一步'"],
    ["label: 'Next Click'", "label: '下一步'"],
    ["label: 'Previous Slide'", "label: '上一页'"],
    ["label: 'Next Slide'", "label: '下一页'"],
    ["label: 'Show slide overview'", "label: '幻灯片概览'"],
    ["label: 'Exit Presenter Mode'", "label: '退出演讲者模式'"],
    ["label: 'Enter Presenter Mode'", "label: '进入演讲者模式'"],
    ["showEditor.value ? 'Hide editor' : 'Show editor'", "showEditor.value ? '隐藏编辑器' : '显示编辑器'"],
    ["drawingEnabled.value ? 'Hide drawing toolbar' : 'Show drawing toolbar'", "drawingEnabled.value ? '隐藏画笔工具栏' : '显示画笔工具栏'"],
    ["isFullscreen.value ? 'Close fullscreen' : 'Enter fullscreen'", "isFullscreen.value ? '退出全屏' : '进入全屏'"],
  ],

  'pages/entry.vue': [
    ['" /> Slides', '" /> 幻灯片'],
    ['" /> Presenter', '" /> 演讲者'],
    ['" /> Remote', '" /> 遥控'],
    ['" /> Notes', '" /> 演讲备注'],
    ['" /> Overview', '" /> 概览'],
  ],

  'internals/SyncControls.vue': [
    ['title="Change sync settings"', 'title="同步设置"'],
    ['title="Sync Mode"', 'title="同步模式"'],
    ['<span op75>Slides navigation syncing for </span>', '<span op75>正在为以下用户同步导航：</span>'],
  ],

  'internals/SlideLoading.vue': [
    ['<div>Loading slide...</div>', '<div>正在加载幻灯片...</div>'],
  ],

  'internals/SlideContainer.vue': [
    ['title="Snapshot"', 'title="快照"'],
  ],

  'internals/SideEditor.vue': [
    ['title="Switch to content tab"', 'title="切换到内容"'],
    ['title="Switch to notes tab"', 'title="切换到备注"'],
    ['title="Dock to right"', 'title="停靠到右侧"'],
    ['title="Dock to bottom"', 'title="停靠到底部"'],
    ['title="Open in editor"', 'title="在编辑器中打开"'],
    ['title="Close"', 'title="关闭"'],
    ['placeholder="Create slide content..."', 'placeholder="输入幻灯片内容..."'],
    ['placeholder="Write some notes..."', 'placeholder="输入演讲备注..."'],
  ],

  'internals/Settings.vue': [
    ['title="Invert"', 'title="反相"'],
    ['title="Brightness"', 'title="亮度"'],
    ['title="Contrast"', 'title="对比度"'],
    ['title="Saturation"', 'title="饱和度"'],
    ['title="Sepia"', 'title="复古"'],
    ['title="Hue Rotate"', 'title="色相旋转"'],
    ['title="Cursor Style"', 'title="光标样式"'],
    ['title="Slide Scale"', 'title="幻灯片缩放"'],
    ['title="Wake Lock"', 'title="保持屏幕常亮"'],
    ['title="Hide Idle Cursor"', 'title="隐藏空闲光标"'],
    ["{ label: 'Cursor', value: 'cursor' }", "{ label: '光标', value: 'cursor' }"],
    ["{ label: 'Laser', value: 'laser' }", "{ label: '激光笔', value: 'laser' }"],
    ["{ label: 'Fit', value: 0 }", "{ label: '自适应', value: 0 }"],
  ],

  'internals/RecordingControls.vue': [
    ['title="Toggle camera view"', 'title="切换摄像头视图"'],
    ['title="Select recording device"', 'title="选择录制设备"'],
  ],

  'internals/RecordingDialog.vue': [
    ['<div class="i-carbon:video my-auto" />Recording', '<div class="i-carbon:video my-auto" />录制'],
    ['placeholder="Enter the title..."', 'placeholder="请输入标题..."'],
    ['<label for="title">Recording Name</label>', '<label for="title">录制名称</label>'],
    ['<div>This will be used in the output filename that might <br>help you better organize your recording chips.</div>', '<div>此名称将用作输出文件名，方便组织录制片段。</div>'],
    ['<label for="framerate">Frame Rate</label>', '<label for="framerate">帧率</label>'],
    ['<label for="resolution">Resolution</label>', '<label for="resolution">分辨率</label>'],
    ['<label for="bitrate">Bitrate</label>', '<label for="bitrate">码率</label>'],
    ['<label for="record-camera" @click="recordCamera = !recordCamera">Record camera separately</label>', '<label for="record-camera" @click="recordCamera = !recordCamera">单独录制摄像头</label>'],
  ],

  'internals/QuickOverview.vue': [
    ['title="Close"', 'title="关闭"'],
    ['title="Slides Overview"', 'title="幻灯片概览"'],
    ['title="Capture slides as images"', 'title="将幻灯片截图为图片"'],
  ],

  'internals/DrawingControls.vue': [
    ['title="Draw with stylus"', 'title="手写笔"'],
    ['title="Draw a line"', 'title="直线"'],
    ['title="Draw an arrow"', 'title="箭头"'],
    ['title="Draw an ellipse"', 'title="椭圆"'],
    ['title="Draw a rectangle"', 'title="矩形"'],
    ['title="Erase"', 'title="橡皮擦"'],
    ['title="Adjust stroke width"', 'title="调整线宽"'],
    ['title="Set brush color"', 'title="设置画笔颜色"'],
    ['title="Undo"', 'title="撤销"'],
    ['title="Redo"', 'title="重做"'],
    ['title="Delete"', 'title="清除"'],
  ],

  'internals/DevicesSelectors.vue': [
    ['title="Camera"', 'title="摄像头"'],
    ['title="Microphone"', 'title="麦克风"'],
    ['title="Video Format"', 'title="视频格式"'],
  ],

  'internals/CodeRunner.vue': [
    ['title="Run code"', 'title="运行代码"'],
  ],

  'internals/ContextMenu.vue': [
    ['Hold <kbd class="border px1 py0.5 border-main rounded text-primary">Shift</kbd> and right click to open the native context menu', '按住 <kbd class="border px1 py0.5 border-main rounded text-primary">Shift</kbd> 再右键可打开浏览器原生菜单'],
  ],

  'internals/ExportPdfTip.vue': [
    ['<div class="i-carbon:information my-auto" /> Tips', '<div class="i-carbon:information my-auto" /> 提示'],
  ],

  'pages/remote.vue': [
    ['title="Increase font size"', 'title="放大字号"'],
    ['title="Decrease font size"', 'title="减小字号"'],
    ['title="Edit Notes"', 'title="编辑备注"'],
    ['title="Go to previous slide"', 'title="上一页"'],
    ['title="Go to next slide"', 'title="下一页"'],
  ],

  'pages/presenter.vue': [
    ['title="Resize notes panel"', 'title="调整备注面板大小"'],
    ['title="Resize notes panel height"', 'title="调整备注面板高度"'],
    ['title="Increase font size"', 'title="放大字号"'],
    ['title="Decrease font size"', 'title="减小字号"'],
    ['title="Edit Notes"', 'title="编辑备注"'],
    ['<span op50 px2>Current</span>', '<span op50 px2>当前</span>'],
    ["{ label: 'Slides', value: 'slides' }", "{ label: '幻灯片', value: 'slides' }"],
    ["{ label: 'Screen Mirror', value: 'mirror' }", "{ label: '镜像屏幕', value: 'mirror' }"],
  ],

  'pages/overview.vue': [
    ['title="Play in new tab"', 'title="在新标签页中播放"'],
    ['title="Open in editor"', 'title="在编辑器中打开"'],
  ],

  'pages/notes.vue': [
    ['title="Increase font size"', 'title="放大字号"'],
    ['title="Decrease font size"', 'title="减小字号"'],
    ['title="Edit notes"', 'title="编辑备注"'],
    ['title="Help"', 'title="帮助"'],
    ['<div class="i-carbon:information my-auto" /> Help', '<div class="i-carbon:information my-auto" /> 帮助'],
  ],

  'pages/notes-edit.vue': [
    ['title="Help"', 'title="帮助"'],
    ['<div class="i-carbon:information my-auto" /> Help', '<div class="i-carbon:information my-auto" /> 帮助'],
    ['<p>The note for each slide are separated by <code>--- #[no]</code> lines, you might want to keep them while editing.</p>', '<p>各页备注由 <code>--- #[no]</code> 分隔，编辑时请保留这些分隔行。</p>'],
  ],

  'pages/export.vue': [
    ['<sup op50 italic text-sm>Experimental</sup>', '<sup op50 italic text-sm>实验性功能</sup>'],
    ['<h2>Options</h2>', '<h2>选项</h2>'],
    ['<h2>Export as Vector File</h2>', '<h2>导出为矢量文件</h2>'],
    ['<h2>Export as Images</h2>', '<h2>导出为图片</h2>'],
    ['<FormItem title="Title">', '<FormItem title="标题">'],
    ['<FormItem title="Range">', '<FormItem title="页面范围">'],
    ['<FormItem title="Color Mode">', '<FormItem title="颜色模式">'],
    ['<FormItem title="With clicks">', '<FormItem title="包含点击步骤">'],
    ['<FormItem title="Delay" description="Delay between capturing each slide in milliseconds.<br>Increase this value if slides are captured incompletely. <br>(Not related to PDF export)">', '<FormItem title="延迟" description="每页截图之间的延迟（毫秒）。<br>如果截图不完整可增大此值。<br>（不影响 PDF 导出）">'],
    ["{ value: false, label: 'Light' }", "{ value: false, label: '浅色' }"],
    ["{ value: true, label: 'Dark' }", "{ value: true, label: '深色' }"],
    ["<span op75>Rendering as {{ capturedImages ? 'Captured Images' : 'DOM' }} </span>", "<span op75>正在以 {{ capturedImages ? '截图' : 'DOM' }} 渲染 </span>"],
  ],

  'internals/Goto.vue': [
    ['placeholder="Goto..."', 'placeholder="跳转到..."'],
  ],

  'builtin/Monaco.vue': [
    ["label: 'Save'", "label: '保存'"],
  ],

  'builtin/BlueSky.vue': [
    ['<span v-if="postNotFound">Could not load Bluesky post</span>', '<span v-if="postNotFound">无法加载 Bluesky 帖子</span>'],
  ],
}

let totalApplied = 0
let totalSkipped = 0
const missingFiles = []

for (const [rel, pairs] of Object.entries(patches)) {
  const file = resolve(CLIENT, rel)
  if (!existsSync(file)) {
    missingFiles.push(rel)
    continue
  }
  let content = readFileSync(file, 'utf8')
  const before = content
  let applied = 0
  let skipped = 0
  for (const [from, to] of pairs) {
    if (content.includes(from)) {
      content = content.split(from).join(to)
      applied++
    } else if (content.includes(to)) {
      skipped++
    } else {
      console.warn(`  ! ${rel}: pattern not found -> ${JSON.stringify(from).slice(0, 80)}`)
    }
  }
  if (content !== before) writeFileSync(file, content)
  totalApplied += applied
  totalSkipped += skipped
  console.log(`  ${rel}: applied=${applied} already-translated=${skipped}`)
}

console.log()
console.log(`Done. ${totalApplied} replacements applied, ${totalSkipped} already in Chinese.`)
if (missingFiles.length) {
  console.log(`Missing files (skipped): ${missingFiles.join(', ')}`)
}
