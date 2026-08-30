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
import { useWindowFocus } from '@vueuse/core'
import { ref } from 'vue'
import { useNav } from '../composables/useNav'
import { useSwipeControls } from '../composables/useSwipeControls'
import { useWakeLock } from '../composables/useWakeLock'
import { slidesTitle } from '../env'
import IconButton from '../internals/IconButton.vue'
import NoteEditable from '../internals/NoteEditable.vue'
import NoteStatic from '../internals/NoteStatic.vue'
import SlideContainer from '../internals/SlideContainer.vue'
import SlidesShow from '../internals/SlidesShow.vue'
import { registerShortcuts } from '../logic/shortcuts'
import { decreasePresenterFontSize, increasePresenterFontSize, presenterNotesFontSize } from '../state'

const inFocus = useWindowFocus()
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
} = useNav()

useHead({ title: \`Remote - \${slidesTitle}\` })

const notesEditing = ref(false)
</script>

<template>
  <div class="bg-main h-full slidev-remote flex flex-col of-hidden">
    <div ref="main" class="relative flex flex-col min-h-0 flex-[1.1_1_0%]">
      <SlideContainer
        class="p-2 lg:p-4 flex-auto"
        is-main
      >
        <SlidesShow render-context="presenter" />
      </SlideContainer>
    </div>

    <div class="py-1 px-2 text-base flex-none border-t border-main" :class="inFocus ? '' : 'op25'">
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

    <div class="min-h-0 flex-[1.3_1_0%] of-hidden">
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

    <nav class="flex flex-none justify-center text-4xl gap-6 p-3 text-$slidev-controls-foreground border-t border-main">
      <IconButton :disabled="!hasPrev" title="Go to previous slide" @click="prev">
        <div class="i-carbon:arrow-left" />
      </IconButton>
      <IconButton :disabled="!hasNext" title="Go to next slide" @click="next">
        <div class="i-carbon:arrow-right" />
      </IconButton>
    </nav>
  </div>
</template>

<style scoped>
.slidev-remote {
  --slidev-controls-foreground: current;
}
</style>
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
