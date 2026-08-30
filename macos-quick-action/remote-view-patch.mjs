#!/usr/bin/env node
// Install the /remote presenter-lite view into @slidev/client.
//
// Idempotent — safe to re-run after (re)installing the shared runtime.
//
//   SLIDEV_RUNTIME="..." node remote-view-patch.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RUNTIME = process.env.SLIDEV_RUNTIME
  || join(__dirname, '..', 'runtime')
const CLIENT = join(RUNTIME, 'node_modules', '@slidev', 'client')

const REMOTE_VUE = `<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener, useLocalStorage, useWindowFocus } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useNav } from '../composables/useNav'
import { useSwipeControls } from '../composables/useSwipeControls'
import { useTimer } from '../composables/useTimer'
import { useWakeLock } from '../composables/useWakeLock'
import { slidesTitle } from '../env'
import CurrentProgressBar from '../internals/CurrentProgressBar.vue'
import IconButton from '../internals/IconButton.vue'
import NoteEditable from '../internals/NoteEditable.vue'
import NoteStatic from '../internals/NoteStatic.vue'
import QuickOverview from '../internals/QuickOverview.vue'
import SlideContainer from '../internals/SlideContainer.vue'
import SlidesShow from '../internals/SlidesShow.vue'
import { isColorSchemaConfigured, isDark, toggleDark } from '../logic/dark'
import { registerShortcuts } from '../logic/shortcuts'
import { decreasePresenterFontSize, increasePresenterFontSize, presenterNotesFontSize, toggleOverview } from '../state'

const inFocus = useWindowFocus()
const root = ref<HTMLDivElement>()
const main = ref<HTMLDivElement>()

registerShortcuts()
useSwipeControls(main)
if (__SLIDEV_FEATURE_WAKE_LOCK__)
  useWakeLock()

const {
  clicksContext,
  currentSlideNo,
  hasNext,
  hasPrev,
  next,
  prev,
  total,
} = useNav()

useHead({ title: \`Remote - \${slidesTitle}\` })

const { status, percentage, timer, reset, toggle } = useTimer()
const timerColor = computed(() => {
  if (status.value === 'stopped')
    return 'op50'
  if (status.value === 'paused')
    return 'text-blue6 dark:text-blue3'
  if (percentage.value > 100)
    return 'text-red6 dark:text-red3'
  if (percentage.value > 80)
    return 'text-yellow6 dark:text-yellow3'
  return 'text-green6 dark:text-green3'
})

const notesEditing = ref(false)
const previewHeight = useLocalStorage('slidev-remote-preview-height', 180)
const isResizing = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(180)

const RESIZER_LIMITS = {
  min: 80,
  maxRatio: 0.7,
}

function clampPreviewHeight(height: number) {
  const max = Math.round((root.value?.clientHeight ?? window.innerHeight) * RESIZER_LIMITS.maxRatio)
  return Math.max(RESIZER_LIMITS.min, Math.min(max, Math.round(height)))
}

function onPreviewResizeStart(e: PointerEvent) {
  if (e.button !== 0)
    return
  e.preventDefault()
  resizeStartY.value = e.clientY
  resizeStartHeight.value = previewHeight.value
  isResizing.value = true
}

function stopResizing() {
  isResizing.value = false
}

useEventListener(window, 'pointermove', (e) => {
  if (!isResizing.value)
    return
  previewHeight.value = clampPreviewHeight(resizeStartHeight.value + e.clientY - resizeStartY.value)
})

useEventListener(window, 'pointerup', stopResizing)
useEventListener(window, 'pointercancel', stopResizing)
useEventListener(window, 'resize', () => {
  previewHeight.value = clampPreviewHeight(previewHeight.value)
})

const REMOTE_VIEWPORT = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
const viewportMeta = typeof document !== 'undefined'
  ? document.querySelector('meta[name="viewport"]')
  : null
const previousViewport = viewportMeta?.getAttribute('content')

onMounted(() => {
  previewHeight.value = clampPreviewHeight(previewHeight.value)
  document.documentElement.classList.add('slidev-remote-no-dblzoom')
  viewportMeta?.setAttribute('content', REMOTE_VIEWPORT)
})

onUnmounted(() => {
  document.documentElement.classList.remove('slidev-remote-no-dblzoom')
  if (previousViewport)
    viewportMeta?.setAttribute('content', previousViewport)
})
</script>

<template>
  <div ref="root" class="bg-main h-full slidev-remote flex flex-col of-hidden">
    <div
      ref="main"
      class="relative flex flex-col min-h-0 flex-none of-hidden"
      :style="{ height: \`\${previewHeight}px\` }"
    >
      <SlideContainer
        class="p-2 lg:p-4 flex-auto"
        is-main
      >
        <SlidesShow render-context="presenter" />
      </SlideContainer>
    </div>

    <CurrentProgressBar />

    <div class="flex items-center py-1 px-2 text-base flex-none border-t border-main" :class="inFocus ? '' : 'op25'">
      <div class="flex-1 flex items-center min-w-0">
        <IconButton title="Increase font size" @click="increasePresenterFontSize">
          <div class="i-carbon:zoom-in" />
        </IconButton>
        <IconButton title="Decrease font size" @click="decreasePresenterFontSize">
          <div class="i-carbon:zoom-out" />
        </IconButton>
        <IconButton
          v-if="__DEV__"
          title="Edit Notes"
          @click="notesEditing = !notesEditing"
        >
          <div class="i-carbon:edit" />
        </IconButton>
      </div>
      <button
        type="button"
        class="preview-resizer"
        :class="{ active: isResizing }"
        role="separator"
        aria-orientation="horizontal"
        title="Resize preview height"
        @pointerdown="onPreviewResizeStart"
      >
        <div class="i-carbon:menu" />
      </button>
      <div class="flex-1 flex items-center justify-end min-w-0">
        <div class="px2 my-auto">
          <span class="text-lg">{{ currentSlideNo }}</span>
          <span class="opacity-50 text-sm"> / {{ total }}</span>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-auto of-hidden">
      <NoteEditable
        v-if="__DEV__"
        :key="\`edit-\${currentSlideNo}\`"
        v-model:editing="notesEditing"
        :no="currentSlideNo"
        class="w-full max-w-full h-full overflow-auto p-2 lg:p-4"
        :clicks-context="clicksContext"
        :style="{ fontSize: \`\${presenterNotesFontSize}em\` }"
      />
      <NoteStatic
        v-else
        :key="\`static-\${currentSlideNo}\`"
        :no="currentSlideNo"
        class="w-full max-w-full h-full overflow-auto p-2 lg:p-4"
        :style="{ fontSize: \`\${presenterNotesFontSize}em\` }"
        :clicks-context="clicksContext"
      />
    </div>

    <div
      class="flex-none flex items-center justify-center gap-5 py-1.5 px-3 select-none border-t border-main"
      :class="timerColor"
    >
      <IconButton
        :title="status === 'running' ? 'Pause timer' : 'Start timer'"
        @click="toggle"
      >
        <div v-if="status === 'running'" class="i-carbon:pause text-2xl" />
        <div v-else class="i-carbon:play text-2xl" />
      </IconButton>
      <div class="text-2xl font-mono min-w-22 text-center">
        <template v-if="timer.h">
          <span>{{ timer.h }}</span>
          <span op50>:</span>
        </template>
        <span>{{ timer.m }}</span>
        <span op50>:</span>
        <span>{{ timer.s }}</span>
      </div>
      <IconButton title="Reset timer" @click="reset">
        <div class="i-carbon:renew text-2xl" />
      </IconButton>
    </div>

    <nav class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center text-4xl p-3 text-$slidev-controls-foreground border-t border-main flex-none">
      <div class="justify-self-start text-xl">
        <IconButton
          v-if="!isColorSchemaConfigured"
          :title="isDark ? 'Switch to light mode theme' : 'Switch to dark mode theme'"
          @click="toggleDark()"
        >
          <div v-if="isDark" class="i-carbon-moon" />
          <div v-else class="i-carbon-sun" />
        </IconButton>
      </div>
      <div class="flex justify-center gap-6">
        <IconButton :disabled="!hasPrev" title="Go to previous slide" @click="prev">
          <div class="i-carbon:arrow-left" />
        </IconButton>
        <IconButton :disabled="!hasNext" title="Go to next slide" @click="next">
          <div class="i-carbon:arrow-right" />
        </IconButton>
      </div>
      <div class="justify-self-end text-xl">
        <IconButton title="Show slide overview" @click="toggleOverview()">
          <div class="i-carbon:apps" />
        </IconButton>
      </div>
    </nav>
  </div>
  <QuickOverview />
</template>

<style>
html.slidev-remote-no-dblzoom,
html.slidev-remote-no-dblzoom * {
  touch-action: manipulation;
}

html.slidev-remote-no-dblzoom .preview-resizer {
  touch-action: none;
}
</style>

<style scoped>
.slidev-remote {
  --slidev-controls-foreground: current;
  touch-action: manipulation;
}

.preview-resizer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  min-width: 2.5rem;
  min-height: 2rem;
  padding: 0.25rem 0.75rem;
  margin: 0;
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.45;
  cursor: row-resize;
  touch-action: none;
  user-select: none;
}

.preview-resizer.active,
.preview-resizer:hover {
  opacity: 0.85;
}
</style>

`

const QUICK_OVERVIEW_VUE = `<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { createFixedClicks } from '../composables/useClicks'
import { useNav } from '../composables/useNav'
import { CLICKS_MAX } from '../constants'
import { pathPrefix } from '../env'
import { currentOverviewPage, overviewRowCount } from '../logic/overview'
import { isScreenshotSupported } from '../logic/screenshot'
import { snapshotManager } from '../logic/snapshot'
import { breakpoints, showOverview, windowSize } from '../state'
import DrawingPreview from './DrawingPreview.vue'
import IconButton from './IconButton.vue'
import SlideContainer from './SlideContainer.vue'
import SlideWrapper from './SlideWrapper.vue'

const nav = useNav()
const { currentSlideNo, go: goSlide, isRemote, slides } = nav

function close() {
  showOverview.value = false
}

function go(page: number) {
  goSlide(page)
  close()
}

function focus(page: number) {
  if (page === currentOverviewPage.value)
    return true
  return false
}

const xs = breakpoints.smaller('xs')
const sm = breakpoints.smaller('sm')

const padding = 4 * 16 * 2
const gap = 2 * 16
const cardWidth = computed(() => {
  if (isRemote.value)
    return (windowSize.width.value - 12 * 2 - 12) / 2
  if (xs.value)
    return windowSize.width.value - padding
  else if (sm.value)
    return (windowSize.width.value - padding - gap) / 2
  return 300
})

const rowCount = computed(() => {
  return Math.floor((windowSize.width.value - padding) / (cardWidth.value + gap))
})

const keyboardBuffer = ref<string>('')
const scroller = ref<HTMLElement>()

async function captureSlidesOverview() {
  showOverview.value = false
  await snapshotManager.startCapturing(nav)
  showOverview.value = true
}

useEventListener('keypress', (e) => {
  if (!showOverview.value) {
    keyboardBuffer.value = ''
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (keyboardBuffer.value) {
      go(+keyboardBuffer.value)
      keyboardBuffer.value = ''
    }
    else {
      go(currentOverviewPage.value)
    }
    return
  }
  const num = Number.parseInt(e.key.replace(/\\D/g, ''))
  if (Number.isNaN(num)) {
    keyboardBuffer.value = ''
    return
  }
  if (!keyboardBuffer.value && num === 0)
    return

  keyboardBuffer.value += String(num)

  // beyond the number of slides, reset
  if (+keyboardBuffer.value > slides.value.length) {
    keyboardBuffer.value = ''
    return
  }

  const extactMatch = slides.value.findIndex(i => \`/\${i.no}\` === keyboardBuffer.value)
  if (extactMatch !== -1)
    currentOverviewPage.value = extactMatch + 1

  // When the input number is the largest at the number of digits, we go to that page directly.
  if (+keyboardBuffer.value * 10 > slides.value.length) {
    go(+keyboardBuffer.value)
    keyboardBuffer.value = ''
  }
})

watchEffect(() => {
  // Watch currentPage, make sure every time we open overview,
  // we focus on the right page.
  currentOverviewPage.value = currentSlideNo.value
  // Watch rowCount, make sure up and down shortcut work correctly.
  overviewRowCount.value = rowCount.value
})

watch(showOverview, async (open) => {
  if (!open || !isRemote.value)
    return
  await nextTick()
  requestAnimationFrame(() => {
    const el = scroller.value?.querySelector(\`[data-overview-no="\${currentSlideNo.value}"]\`)
    el?.scrollIntoView({ block: 'center', inline: 'nearest' })
  })
})
</script>

<template>
  <Transition
    enter-active-class="duration-150 ease-out"
    enter-from-class="opacity-0 scale-102 !backdrop-blur-0px"
    leave-active-class="duration-200 ease-in"
    leave-to-class="opacity-0 scale-102 !backdrop-blur-0px"
  >
    <div
      v-if="showOverview"
      :class="isRemote
        ? 'fixed inset-0 z-modal bg-main !bg-opacity-75 flex flex-col backdrop-blur-5px select-none'
        : 'fixed left-0 right-0 top-0 h-[calc(var(--vh,1vh)*100)] z-modal bg-main !bg-opacity-75 p-16 py-20 overflow-y-auto backdrop-blur-5px select-none'"
      @click="close"
    >
      <div
        ref="scroller"
        :class="isRemote ? 'min-h-0 flex-auto overflow-y-auto px-3 py-3' : 'contents'"
      >
        <div
          class="grid w-full"
          :class="isRemote ? 'grid-cols-2 gap-3' : 'gap-y-4 gap-x-8'"
          :style="isRemote ? undefined : \`grid-template-columns: repeat(auto-fit,minmax(\${cardWidth}px,1fr))\`"
        >
          <div
            v-for="(route, idx) of slides"
            :key="route.no"
            class="relative"
            :data-overview-no="route.no"
          >
            <div
              class="inline-block border rounded overflow-hidden bg-main hover:border-primary transition"
              :class="[
                isRemote ? 'w-full' : '',
                (focus(idx + 1) || currentOverviewPage === idx + 1)
                  ? (isRemote ? 'border-primary border-4' : 'border-primary')
                  : 'border-main',
              ]"
              @click="go(route.no)"
            >
              <SlideContainer
                :key="route.no"
                :no="route.no"
                :use-snapshot="true"
                :width="cardWidth"
                class="pointer-events-none"
              >
                <SlideWrapper
                  :clicks-context="createFixedClicks(route, CLICKS_MAX)"
                  :route="route"
                  render-context="overview"
                />
                <DrawingPreview :page="route.no" />
              </SlideContainer>
            </div>
            <div
              class="absolute top-0"
              :class="isRemote ? 'left-1 top-1 px-1.5 py-0.5 rounded bg-main bg-opacity-90 text-xs leading-4' : ''"
              :style="isRemote ? undefined : \`left: \${cardWidth + 5}px\`"
            >
              <template v-if="keyboardBuffer && String(idx + 1).startsWith(keyboardBuffer)">
                <span class="text-green font-bold">{{ keyboardBuffer }}</span>
                <span class="opacity-50">{{ String(idx + 1).slice(keyboardBuffer.length) }}</span>
              </template>
              <span v-else :class="isRemote ? '' : 'opacity-50'">
                {{ idx + 1 }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="isRemote"
        class="flex-none flex items-center justify-center py-2 border-t border-main"
        @click.stop
      >
        <IconButton title="Close" class="text-2xl" @click="close">
          <div class="i-carbon:close" />
        </IconButton>
      </div>
    </div>
  </Transition>
  <div
    v-show="showOverview && !isRemote"
    class="fixed top-4 right-4 z-modal text-gray-400 flex flex-col items-center gap-2"
  >
    <IconButton title="Close" class="text-2xl" @click="close">
      <div class="i-carbon:close" />
    </IconButton>
    <IconButton
      v-if="!isRemote && __SLIDEV_FEATURE_PRESENTER__"
      as="a"
      title="Slides Overview"
      target="_blank"
      :href="\`\${pathPrefix}overview\`"
      tab-index="-1"
      class="text-2xl"
    >
      <div class="i-carbon:list-boxes" />
    </IconButton>
    <IconButton
      v-if="!isRemote && __DEV__ && isScreenshotSupported"
      title="Capture slides as images"
      class="text-2xl"
      @click="captureSlidesOverview"
    >
      <div class="i-carbon:drop-photo" />
    </IconButton>
  </div>
</template>

`

/** @type {Array<[string, string, string]>} */
const FILE_PATCHES = [
  ['setup/routes.ts',
    `      {
        path: '/presenter',
        redirect: { path: '/presenter/1' },
      },
    )`,
    `      {
        path: '/presenter',
        redirect: { path: '/presenter/1' },
      },
      {
        name: 'remote',
        path: '/remote/:no',
        component: () => import('../pages/remote.vue'),
        beforeEnter: passwordGuard,
      },
      {
        path: '/remote',
        redirect: { path: '/remote/1' },
      },
    )`],
  ['logic/slidePath.ts',
    `export function getSlideRoutePath(
  route: SlideRoute,
  presenter: boolean,
  exporting: boolean = false,
) {
  const no = route.meta.slide?.frontmatter.routeAlias ?? route.no
  return exporting ? \`/export/\${no}\` : presenter ? \`/presenter/\${no}\` : \`/\${no}\`
}`,
    `export function getSlideRoutePath(
  route: SlideRoute,
  presenter: boolean | 'remote',
  exporting: boolean = false,
) {
  const no = route.meta.slide?.frontmatter.routeAlias ?? route.no
  if (exporting)
    return \`/export/\${no}\`
  if (presenter === 'remote')
    return \`/remote/\${no}\`
  if (presenter)
    return \`/presenter/\${no}\`
  return \`/\${no}\`
}`],
  ['logic/slides.ts',
    `  presenter: boolean,`,
    `  presenter: boolean | 'remote',`],
  ['composables/useNav.ts',
    `  isPresenter: ComputedRef<boolean>
  isNotesViewer: ComputedRef<boolean>`,
    `  isPresenter: ComputedRef<boolean>
  isRemote: ComputedRef<boolean>
  isNotesViewer: ComputedRef<boolean>`],
  ['composables/useNav.ts',
    `  isPrint: Ref<boolean>,
  router?: Router,
): SlidevContextNav {
  const total = computed(() => slides.value.length)

  const navDirection = ref(0)
  const clicksDirection = ref(0)

  const currentPath = computed(() => getSlidePath(currentSlideRoute.value, isPresenter.value))`,
    `  isPrint: Ref<boolean>,
  router?: Router,
  isRemote: Ref<boolean> = ref(false),
): SlidevContextNav {
  const total = computed(() => slides.value.length)

  const navDirection = ref(0)
  const clicksDirection = ref(0)

  const controlPath = computed(() => isRemote.value ? 'remote' as const : isPresenter.value)
  const currentPath = computed(() => getSlidePath(currentSlideRoute.value, controlPath.value))`],
  ['composables/useNav.ts',
    `        path: getSlidePath(no, isPresenter.value, router.currentRoute.value.name === 'export'),`,
    `        path: getSlidePath(no, controlPath.value, router.currentRoute.value.name === 'export'),`],
  ['composables/useNav.ts',
    `  const isPresenter = computed(() => currentRoute.name === 'presenter')
  const isNotesViewer = computed(() => currentRoute.name === 'notes')
  const isPresenterAvailable = computed(() => !isPresenter.value && (!configs.remote || query.value.get('password') === configs.remote))`,
    `  const isPresenter = computed(() => currentRoute.name === 'presenter')
  const isRemote = computed(() => currentRoute.name === 'remote')
  const isNotesViewer = computed(() => currentRoute.name === 'notes')
  const isPresenterAvailable = computed(() => !isPresenter.value && !isRemote.value && (!configs.remote || query.value.get('password') === configs.remote))`],
  ['composables/useNav.ts',
    `    isPresenter,
    isNotesViewer,
    isPresenterAvailable,`,
    `    isPresenter,
    isRemote,
    isNotesViewer,
    isPresenterAvailable,`],
  ['composables/useNav.ts',
    `    state.isPresenter,
    state.isPrintMode,
    router,
  )`,
    `    state.isPresenter,
    state.isPrintMode,
    router,
    state.isRemote,
  )`],
  ['setup/root.ts',
    `    isNotesViewer,
    isPresenter,
    isPrintMode,
  } = useNav()`,
    `    isNotesViewer,
    isPresenter,
    isRemote,
    isPrintMode,
  } = useNav()
  const hasPresenterControl = computed(() => isPresenter.value || isRemote.value)`],
  ['setup/root.ts',
    `  const syncType = computed(() => isPresenter.value ? 'presenter' : 'viewer')

  // update shared state
  function updateSharedState() {
    const shouldSend = isPresenter.value
      ? syncDirections.value.presenterSend
      : syncDirections.value.viewerSend

    if (!shouldSend)
      return
    if (isNotesViewer.value || isPrintMode.value)
      return
    // we allow Presenter mode, or Viewer mode from trusted origins to update the shared state
    if (!isPresenter.value && !TRUST_ORIGINS.includes(location.host.split(':')[0]))
      return`,
    `  const syncType = computed(() => hasPresenterControl.value ? 'presenter' : 'viewer')

  // update shared state
  function updateSharedState() {
    const shouldSend = hasPresenterControl.value
      ? syncDirections.value.presenterSend
      : syncDirections.value.viewerSend

    if (!shouldSend)
      return
    if (isNotesViewer.value || isPrintMode.value)
      return
    // we allow Presenter mode, Remote mode, or Viewer mode from trusted origins to update the shared state
    if (!hasPresenterControl.value && !TRUST_ORIGINS.includes(location.host.split(':')[0]))
      return`],
  ['setup/root.ts',
    `    const shouldReceive = isPresenter.value
      ? syncDirections.value.presenterReceive
      : syncDirections.value.viewerReceive
    if (!shouldReceive)
      return
    if (!hasPrimarySlide.value || isPrintMode.value)
      return
    if (state.lastUpdate?.type === syncType.value)
      return
    if ((+state.page === +currentSlideNo.value && +clicksContext.value.current === +state.clicks))
      return
    // if (state.lastUpdate?.type === 'presenter') {
    hmrSkipTransition.value = false
    router.replace({
      path: getSlidePath(state.page, isPresenter.value),`,
    `    const shouldReceive = hasPresenterControl.value
      ? syncDirections.value.presenterReceive
      : syncDirections.value.viewerReceive
    if (!shouldReceive)
      return
    if (!hasPrimarySlide.value || isPrintMode.value)
      return
    if (state.lastUpdate?.type === syncType.value)
      return
    if ((+state.page === +currentSlideNo.value && +clicksContext.value.current === +state.clicks))
      return
    // if (state.lastUpdate?.type === 'presenter') {
    hmrSkipTransition.value = false
    router.replace({
      path: getSlidePath(state.page, isRemote.value ? 'remote' : isPresenter.value),`],
  ['pages/entry.vue',
    `    <RouterLink to="/presenter" class="page-link">
      <div class="i-carbon:user-speaker" /> 演讲者
    </RouterLink>
    <RouterLink to="/notes" class="page-link">`,
    `    <RouterLink to="/presenter" class="page-link">
      <div class="i-carbon:user-speaker" /> 演讲者
    </RouterLink>
    <RouterLink to="/remote" class="page-link">
      <div class="i-carbon:devices" /> Remote
    </RouterLink>
    <RouterLink to="/notes" class="page-link">`],
  ['pages/entry.vue',
    `    <RouterLink to="/presenter" class="page-link">
      <div class="i-carbon:user-speaker" /> Presenter
    </RouterLink>
    <RouterLink to="/notes" class="page-link">`,
    `    <RouterLink to="/presenter" class="page-link">
      <div class="i-carbon:user-speaker" /> Presenter
    </RouterLink>
    <RouterLink to="/remote" class="page-link">
      <div class="i-carbon:devices" /> Remote
    </RouterLink>
    <RouterLink to="/notes" class="page-link">`],
  ['builtin/TocList.vue',
    `const { isPresenter } = useNav()`,
    `const { isPresenter, isRemote } = useNav()`],
  ['builtin/TocList.vue',
    `      <Link :to="isPresenter ? \`/presenter\${item.path}\` : item.path">`,
    `      <Link :to="isRemote ? \`/remote\${item.path}\` : isPresenter ? \`/presenter\${item.path}\` : item.path">`],
]

function applyPair(source, from, to) {
  if (source.includes(to) && !source.includes(from))
    return { source, status: 'skipped' }
  if (!source.includes(from))
    return { source, status: 'missed' }
  return { source: source.replace(from, to), status: 'applied' }
}

if (!existsSync(CLIENT)) {
  console.error(`[remote-view] @slidev/client not found: ${CLIENT}`)
  process.exitCode = 1
  process.exit()
}

mkdirSync(join(CLIENT, 'pages'), { recursive: true })
writeFileSync(join(CLIENT, 'pages', 'remote.vue'), REMOTE_VUE)
writeFileSync(join(CLIENT, 'internals', 'QuickOverview.vue'), QUICK_OVERVIEW_VUE)

let applied = 0
let skipped = 0
let missed = 0

for (const [rel, from, to] of FILE_PATCHES) {
  const file = join(CLIENT, rel)
  if (!existsSync(file)) {
    console.error(`[remote-view] missing ${rel}`)
    missed++
    process.exitCode = 1
    continue
  }
  const current = readFileSync(file, 'utf8')
  const { source, status } = applyPair(current, from, to)
  if (status === 'applied') {
    writeFileSync(file, source)
    applied++
  }
  else if (status === 'skipped') {
    skipped++
  }
  else {
    // Alternate English/Chinese entry needles are expected to miss one side.
    if (rel === 'pages/entry.vue' && (current.includes('to="/remote"') || current.includes("to='/remote'"))) {
      skipped++
      continue
    }
    console.error(`[remote-view] needle missed: ${rel}`)
    missed++
    process.exitCode = 1
  }
}

console.log(`[remote-view] applied ${applied}, skipped ${skipped}, missed ${missed}`)
