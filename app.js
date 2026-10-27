const state = { items: [], selectedId: null, toastTimer: null };
const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const piecesHost = $('pieces');
const photoInput = $('photoInput');
const cameraInput = $('cameraInput');
const addSheet = $('addSheet');
const processing = $('processing');

function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => node.classList.remove('visible'), 2600);
}

function updateControls() {
  const hasItems = state.items.length > 0;
  $('saveButton').disabled = !hasItems;
  $('clearButton').disabled = !hasItems;
  $('emptyState').hidden = hasItems;
  $('canvasCount').textContent = hasItems ? `${state.items.length} ${state.items.length === 1 ? 'item' : 'items'}` : '';
}

function selectItem(id) {
  state.selectedId = id;
  document.querySelectorAll('.placed-piece').forEach(node => {
    node.classList.toggle('selected', node.dataset.id === id);
  });
}

function renderItems() {
  piecesHost.replaceChildren();
  for (const item of state.items) {
    const wrapper = document.createElement('div');
    wrapper.className = `placed-piece${state.selectedId === item.id ? ' selected' : ''}`;
    wrapper.dataset.id = item.id;
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', 'Clothing item. Drag to move; use the corner handle to resize.');
    wrapper.style.left = `${item.x}%`;
    wrapper.style.top = `${item.y}%`;
    wrapper.style.width = `${item.width}px`;
    wrapper.style.height = `${item.width * item.ratio}px`;

    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.name || 'Clothing item';
    image.draggable = false;
    wrapper.append(image);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'piece-delete';
    remove.setAttribute('aria-label', 'Remove item');
    remove.textContent = '×';
    remove.addEventListener('pointerdown', event => event.stopPropagation());
    remove.addEventListener('click', event => {
      event.stopPropagation();
      state.items = state.items.filter(piece => piece.id !== item.id);
      if (state.selectedId === item.id) state.selectedId = null;
      renderItems();
    });
    wrapper.append(remove);

    const resize = document.createElement('button');
    resize.type = 'button';
    resize.className = 'resize-handle';
    resize.setAttribute('aria-label', 'Resize item');
    resize.addEventListener('pointerdown', event => startResize(event, item, wrapper));
    wrapper.append(resize);

    wrapper.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      startDrag(event, item, wrapper);
    });
    wrapper.addEventListener('click', () => selectItem(item.id));
    piecesHost.append(wrapper);
  }
  updateControls();
}

function startDrag(event, item, wrapper) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  selectItem(item.id);
  const rect = canvas.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const originalX = item.x;
  const originalY = item.y;
  wrapper.setPointerCapture(event.pointerId);
  const move = e => {
    item.x = Math.max(3, Math.min(97, originalX + (e.clientX - startX) / rect.width * 100));
    item.y = Math.max(5, Math.min(95, originalY + (e.clientY - startY) / rect.height * 100));
    wrapper.style.left = `${item.x}%`;
    wrapper.style.top = `${item.y}%`;
  };
  const finish = () => {
    wrapper.removeEventListener('pointermove', move);
    wrapper.removeEventListener('pointerup', finish);
    wrapper.removeEventListener('pointercancel', finish);
  };
  wrapper.addEventListener('pointermove', move);
  wrapper.addEventListener('pointerup', finish);
  wrapper.addEventListener('pointercancel', finish);
}

function startResize(event, item, wrapper) {
  event.preventDefault();
  event.stopPropagation();
  selectItem(item.id);
  const startX = event.clientX;
  const startWidth = item.width;
  wrapper.setPointerCapture(event.pointerId);
  const move = e => {
    item.width = Math.round(Math.max(58, Math.min(340, startWidth + e.clientX - startX)));
    wrapper.style.width = `${item.width}px`;
    wrapper.style.height = `${item.width * item.ratio}px`;
  };
  const finish = () => {
    wrapper.removeEventListener('pointermove', move);
    wrapper.removeEventListener('pointerup', finish);
    wrapper.removeEventListener('pointercancel', finish);
  };
  wrapper.addEventListener('pointermove', move);
  wrapper.addEventListener('pointerup', finish);
  wrapper.addEventListener('pointercancel', finish);
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('This photo format could not be opened.'));
      image.onload = () => resolve(image);
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function median(values) {
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

function removePlainBackground(image) {
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const context = work.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  const data = frame.data;
  const border = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const x = Math.round((width - 1) * i / steps);
    const y = Math.round((height - 1) * i / steps);
    border.push((y * width + x) * 4, (y * width + (width - 1 - x)) * 4);
    border.push((y * width) * 4, (y * width + width - 1) * 4);
  }
  const background = [0, 1, 2].map(channel => median(border.map(offset => data[offset + channel])));
  const tolerance = 58;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let read = 0;
  let write = 0;
  const tryPixel = pixel => {
    if (pixel < 0 || pixel >= width * height || visited[pixel]) return;
    visited[pixel] = 1;
    const offset = pixel * 4;
    const dr = data[offset] - background[0];
    const dg = data[offset + 1] - background[1];
    const db = data[offset + 2] - background[2];
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= tolerance) {
      data[offset + 3] = 0;
      queue[write++] = pixel;
    }
  };
  for (let x = 0; x < width; x++) {
    tryPixel(x);
    tryPixel((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryPixel(y * width);
    tryPixel(y * width + width - 1);
  }
  while (read < write) {
    const pixel = queue[read++];
    const x = pixel % width;
    if (x > 0) tryPixel(pixel - 1);
    if (x < width - 1) tryPixel(pixel + 1);
    if (pixel >= width) tryPixel(pixel - width);
    if (pixel < width * (height - 1)) tryPixel(pixel + width);
  }
  context.putImageData(frame, 0, 0);
  return { src: work.toDataURL('image/png'), width, height, removed: write };
}

async function addPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;
  addSheet.close();
  processing.hidden = false;
  try {
    const image = await readPhoto(file);
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30)));
    const cutout = removePlainBackground(image);
    const ratio = cutout.height / cutout.width;
    const bounds = canvas.getBoundingClientRect();
    let itemWidth = Math.min(165, bounds.width * .38, bounds.height * .66 / ratio);
    if (!Number.isFinite(itemWidth) || itemWidth < 58) itemWidth = 110;
    const positions = [[50, 49], [39, 46], [61, 46], [42, 62], [59, 62], [50, 34]];
    const position = positions[state.items.length % positions.length];
    const item = {
      id: (globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      name: file.name || 'Clothing item', src: cutout.src, ratio,
      width: Math.round(itemWidth), x: position[0], y: position[1]
    };
    state.items.push(item);
    state.selectedId = item.id;
    renderItems();
    if (cutout.removed < cutout.width * cutout.height * .008) {
      toast('Added. A plain background gives a cleaner cutout.');
    } else {
      toast('Added to canvas');
    }
  } catch (error) {
    toast(error.message || 'Could not add that photo. Try another one.');
  } finally {
    processing.hidden = true;
  }
}

function canvasBlob() {
  return new Promise((resolve, reject) => {
    const rect = canvas.getBoundingClientRect();
    const scale = 2;
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(rect.width * scale));
    output.height = Math.max(1, Math.round(rect.height * scale));
    const context = output.getContext('2d');
    context.fillStyle = getComputedStyle(canvas).backgroundColor;
    context.fillRect(0, 0, output.width, output.height);
    const loaded = state.items.map(item => new Promise(done => {
      const image = new Image();
      image.onload = () => {
        const x = item.x / 100 * output.width;
        const y = item.y / 100 * output.height;
        const w = item.width * scale;
        const h = w * item.ratio;
        context.drawImage(image, x - w / 2, y - h / 2, w, h);
        done();
      };
      image.onerror = () => done();
      image.src = item.src;
    }));
    Promise.all(loaded).then(() => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the image.')), 'image/png'));
  });
}

async function saveImage() {
  if (!state.items.length) return;
  const button = $('saveButton');
  button.disabled = true;
  button.textContent = 'Preparing…';
  try {
    const blob = await canvasBlob();
    const file = new File([blob], 'fitfolio-canvas.png', { type: 'image/png' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file], title: 'Fitfolio outfit' });
      toast('Choose Save Image or a sharing app.');
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fitfolio-canvas.png';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Image downloaded.');
    }
  } catch (error) {
    if (error.name !== 'AbortError') toast('Could not save the image. Please try again.');
  } finally {
    button.disabled = false;
    button.textContent = 'Save image';
  }
}

$('addButton').addEventListener('click', () => addSheet.showModal());
$('closeSheet').addEventListener('click', () => addSheet.close());
$('takePhoto').addEventListener('click', () => cameraInput.click());
$('choosePhoto').addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', event => { addPhoto(event.target.files?.[0]); event.target.value = ''; });
cameraInput.addEventListener('change', event => { addPhoto(event.target.files?.[0]); event.target.value = ''; });
$('saveButton').addEventListener('click', saveImage);
$('clearButton').addEventListener('click', () => {
  if (!state.items.length) return;
  if (!window.confirm('Clear all items from this canvas?')) return;
  state.items = [];
  state.selectedId = null;
  renderItems();
});
canvas.addEventListener('pointerdown', event => {
  if (event.target === canvas || event.target === piecesHost) selectItem(null);
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && addSheet.open) addSheet.close();
  if ((event.key === 'Backspace' || event.key === 'Delete') && state.selectedId && !addSheet.open) {
    state.items = state.items.filter(item => item.id !== state.selectedId);
    state.selectedId = null;
    renderItems();
  }
});

renderItems();
