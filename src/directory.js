import {createStudio} from './app.js?v=20260914-18';
import {pairCatalogs} from './comparison.js?v=20260914-4';

const status = document.querySelector('#directory-status');
const form = document.querySelector('#directory-form');
const pathInput = document.querySelector('#directory-path');
const fpsInput = document.querySelector('#directory-fps');
const submit = document.querySelector('#load-directory');
const mount = document.querySelector('#directory-view');
const compareMode = document.querySelector('#compare-mode');
const comparePath = document.querySelector('#compare-path');
const compareCPath = document.querySelector('#compare-c-path');
const OURS = '/efs/jiazhishu/Results/UMM/omni_motion/omni_1.7b_hymotion201_ieg_staged_t2m_m2t/stage2_tm2m/15000/t2m_0015000_human64';
const HY = '/efs/jiazhishu/Results/Baseline/HY-Motion-1.0/t2m_human64';
const MOTION_MILLION = '/efs/jiazhishu/Results/Baseline/motionmillion_3B_train/t2m_human64';
function updateMode() {
  document.querySelector('#compare-path-row').hidden = !compareMode.checked;
  document.querySelector('#compare-c-path-row').hidden = !compareMode.checked;
  comparePath.required = compareMode.checked;
  if (compareMode.checked && !comparePath.value) comparePath.value = pathInput.value.includes('HY-Motion') ? OURS : HY;
}
function modelLabel(path, fallback) {
  if (path.includes('/HY-Motion-1.0/')) return 'HY 1B';
  if (path.includes('/motionmillion_3B_train/')) return 'MotionMillion 3B';
  if (path.includes('/omni_1.7b_hymotion201_ieg_staged_t2m_m2t/')) return 'Ours';
  return fallback;
}
let controller, request = 0;

async function fetchCatalog(path) {
  const query = new URLSearchParams({fps: fpsInput.value});
  if (path.trim()) query.set('directory', path.trim());
  const response = await fetch(`/api/catalog?${query}`, {cache: 'no-store'});
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Directory loading needs the local directory-viewer service. Open its preview URL.');
  const catalog = await response.json();
  if (!response.ok) throw new Error(catalog.error || 'Could not read this directory.');
  return catalog;
}

async function loadDirectory() {
  const version = ++request;
  submit.disabled = true; status.dataset.error = 'false'; status.textContent = 'Reading motion files…';
  try {
    const comparing = compareMode.checked;
    const requestedPaths = [pathInput.value, ...(comparing ? [comparePath.value, compareCPath.value].filter(path => path.trim()) : [])];
    const catalogs = await Promise.all(requestedPaths.map(fetchCatalog));
    const labels = catalogs.map((catalog, index) => modelLabel(catalog.directory, `Model ${String.fromCharCode(65 + index)}`));
    const catalog = comparing ? pairCatalogs(catalogs, labels) : catalogs[0];
    if (version !== request) return;
    const skipped = document.querySelector('#skipped-files');
    skipped.hidden = !catalog.skipped.length;
    skipped.querySelector('summary').textContent = `${catalog.skipped.length} files skipped — view reasons`;
    const list = skipped.querySelector('ul'); list.replaceChildren();
    catalog.skipped.forEach(item => { const li = document.createElement('li'); li.textContent = `${item.file}: ${item.reason}`; list.append(li); });
    if (!catalog.samples.length) throw new Error(comparing ? 'No matching motions found across the selected models. Check the indices and prompts.' : 'No compatible motions found. Expected float .npy arrays shaped [T, 272].');
    controller?.dispose(); mount.replaceChildren();
    const root = document.createElement('div'); root.className = 'studio'; root.dataset.task = 't2m'; mount.append(root);
    controller = createStudio(root, 't2m', catalog);
    pathInput.value = catalog.directory;
    if (comparing) {
      comparePath.value = catalogs[1].directory;
      compareCPath.value = catalogs[2]?.directory ?? '';
    }
    const colorNames = ['Blue', 'Orange', 'Purple'];
    status.textContent = comparing ? `${catalog.samples.length} matched cases · ${labels.map((label, index) => `${colorNames[index]}: ${label}`).join(' · ')} · Shared time and camera.` : `${catalog.samples.length} motions loaded · Select a file in the viewer. Refresh to discover new or changed files.`;
    const url = new URLSearchParams({directory: catalog.directory, fps: fpsInput.value});
    if (comparing) url.set('compare', catalogs[1].directory);
    if (catalogs[2]) url.set('compareC', catalogs[2].directory);
    history.replaceState(null, '', `?${url}`);
  } catch (error) {
    if (version !== request) return;
    status.dataset.error = 'true'; status.textContent = error.message + (controller ? ' The previously loaded viewer is still available.' : '');
  } finally { if (version === request) submit.disabled = false; }
}

async function initialize() {
  try {
    // Reuse the paper viewer's template without duplicating its controls.
    const response = await fetch('index.html');
    if (!response.ok) throw new Error('Could not load the viewer controls.');
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    const template = page.querySelector('#viewer-template');
    if (!template) throw new Error('Viewer template is missing.');
    document.body.append(document.importNode(template, true));
    const settingsResponse = await fetch('/api/config', {cache: 'no-store'});
    if (!settingsResponse.ok || !settingsResponse.headers.get('content-type')?.includes('application/json'))
      throw new Error('Open this page through the local directory-viewer service to load server directories.');
    const settings = await settingsResponse.json();
    const query = new URLSearchParams(location.search);
    pathInput.value = query.get('directory') || settings.directory;
    fpsInput.value = query.get('fps') || String(settings.fps);
    compareMode.checked = query.has('compare'); comparePath.value = query.get('compare') || ''; compareCPath.value = query.get('compareC') || ''; updateMode();
    compareMode.addEventListener('change', updateMode);
    document.querySelector('#comparison-preset').addEventListener('click', () => {
      pathInput.value = OURS; comparePath.value = HY; compareCPath.value = MOTION_MILLION; compareMode.checked = true; updateMode(); loadDirectory();
    });
    form.addEventListener('submit', event => { event.preventDefault(); loadDirectory(); });
    let last = performance.now(), animation;
    function tick(now) {
      if (!document.hidden) controller?.tick(Math.min((now - last) / 1000, .1));
      last = now; animation = requestAnimationFrame(tick);
    }
    animation = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', () => { if (document.hidden) controller?.pause(); });
    window.addEventListener('pagehide', event => { controller?.pause(); if (!event.persisted) { ++request; cancelAnimationFrame(animation); controller?.dispose(); } });
    await loadDirectory();
  } catch (error) { status.dataset.error = 'true'; status.textContent = error.message; }
}
initialize();
