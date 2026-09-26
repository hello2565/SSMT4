import { createApp } from "vue";
import App from "./App.vue";
import router, { prefetchRouteComponents } from "./router";
import { ArrowLeft, ArrowRight, Delete, Download, Edit, Folder, FolderAdd, FolderOpened, Picture, Plus, Refresh, RefreshRight, VideoPlay } from '@element-plus/icons-vue';
import 'element-plus/dist/index.css';

import 'element-plus/theme-chalk/dark/css-vars.css';
import './styles/index.css';
import { AppStateManager } from "./store/AppStateManager";
import { pinia } from "./pinia";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { bindI18nLocaleToSettings, i18n } from "./i18n";
import { triggerSilentStartupAppUpdateCheck } from "./common/AppSelfUpdate";

const app = createApp(App);

const tryGetCurrentWindow = () => {
  try {
    return getCurrentWindow();
  } catch (err) {
    console.error('Failed to access Tauri current window during bootstrap:', err);
    return null;
  }
};

window.addEventListener('error', (event) => {
  console.error('Global runtime error:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

app.use(pinia);
app.use(i18n);

bindI18nLocaleToSettings(AppStateManager.appSettings);

app.component('ArrowLeft', ArrowLeft)
app.component('ArrowRight', ArrowRight)
app.component('Delete', Delete)
app.component('Download', Download)
app.component('Edit', Edit)
app.component('Folder', Folder)
app.component('FolderAdd', FolderAdd)
app.component('FolderOpened', FolderOpened)
app.component('Picture', Picture)
app.component('Plus', Plus)
app.component('Refresh', Refresh)
app.component('RefreshRight', RefreshRight)
app.component('VideoPlay', VideoPlay)

app.use(router);
app.mount("#app");


// 主窗口初始为隐藏，只有 initAppState 结束（成功或失败）后才会显示。
// 若初始化在别人机器上因网络/权限等意外挂起， neither then nor catch 都不会执行，
// 窗口将永远不显示（表现为"双击没反应"）。超时后强制显示窗口兜底。
const INIT_SHOW_TIMEOUT_MS = 15000

const initTimeoutPromise = new Promise<'timeout'>((resolve) => {
  setTimeout(() => resolve('timeout'), INIT_SHOW_TIMEOUT_MS)
})

Promise.race([
  AppStateManager.initAppState().then(() => 'ready' as const),
  initTimeoutPromise,
]).then((state) => {
  if (state === 'timeout') {
    console.warn(`initAppState did not settle within ${INIT_SHOW_TIMEOUT_MS}ms; showing window anyway`);
  }

  // Warm sub-page chunks in the background so first-time page switches are fast
  prefetchRouteComponents();

  const appWindow = tryGetCurrentWindow();
  if (!appWindow) {
    return;
  }

  const finalizeWindowBootstrap = async () => {
    try {
      await AppStateManager.prepareWindowForDisplay();
      await appWindow.show();
      await appWindow.setFocus();

      triggerSilentStartupAppUpdateCheck();
    } catch (err) {
      console.warn('Failed to show/focus window:', err);
    }
  }

  void finalizeWindowBootstrap()
}).catch((err: unknown) => {
  console.error('initAppState failed:', err);
  // Ensure window shows even if init fails.
  const appWindow = tryGetCurrentWindow();
  if (!appWindow) {
    return;
  }

  void AppStateManager.prepareWindowForDisplay()
    .catch((prepareErr: unknown) => {
      console.warn('Failed to prepare window after init error:', prepareErr);
    })
    .finally(() => {
      appWindow.show().catch((showErr: unknown) => {
        console.warn('Failed to show window after init error:', showErr);
      }).finally(() => {
        triggerSilentStartupAppUpdateCheck();
      });
    });
});
