const STORE_KEY = 'fitfolio-v1';
const state = { clothes: [], fits: [], board: [], category: 'all', libraryCategory: 'all', currentImage: null, pendingCutout: null, activeEdit: null, selectedItem: null };
const $ = (id) => document.getElementById(id);
const photoInput = $('photoInput');
const itemDialog = $('itemDialog');
const removeDialog = $('removeDialog');
let toastTimer;

function load() {
  try { const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); state.clothes = saved.clothes || []; state.fits = saved.fits || []; }
  catch { state.clothes = []; state.fits = []; }
}
function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify({clothes:state.clothes,fits:state.fits})); } catch { showToast('Storage is full. Try using smaller photos.'); } updateCounts(); }
function showToast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2400); }
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function categoryLabel(key) { return ({tops:'Top',bottoms:'Bottom',shoes:'Shoes',extras:'Extra','one-pieces':'One-piece'})[key] || 'Piece'; }
function updateCounts() { $('wardrobeCount').textContent=state.clothes.length; $('fitCount').textContent=state.fits.length; $('allCount').textContent=state.clothes.length; $('libraryAllCount').textContent=state.clothes.length; $('libraryCount').textContent=state.clothes.length; }
function render() { renderStudioWardrobe(); renderLibrary(); renderFits(); renderBoard(); updateCounts(); }
function setView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  $(`${name}View`).classList.add('active'); $('crumbTitle').textContent=({studio:'OUTFIT STUDIO',wardrobe:'MY WARDROBE',fitfolio:'FITFOLIO'})[name];
  window.scrollTo({top:0,behavior:'smooth'});
}
function filteredClothes(category) { return state.clothes.filter(x=>category==='all'||x.category===category); }
function renderStudioWardrobe() {
  const items=filteredClothes(state.category), host=$('studioWardrobe'); host.innerHTML='';
  $('studioEmpty').classList.toggle('show',state.clothes.length===0);
  if(state.clothes.length===0) return;
  items.forEach(item=>{ const card=document.createElement('button'); card.className='mini-card'; card.type='button'; card.title=`Add ${item.name} to board`; card.innerHTML=`<span class="mini-photo"><img src="${item.image}" alt=""></span><span class="mini-name">${escapeHtml(item.name)}</span><span class="plus-overlay">＋</span>`; card.addEventListener('click',()=>addToBoard(item.id)); host.append(card); });
  if(items.length===0) host.innerHTML='<p class="empty-filter">Nothing in this category yet.</p>';
}
function renderLibrary() {
  const host=$('wardrobeGrid'),items=filteredClothes(state.libraryCategory);host.innerHTML='';
  $('wardrobeEmpty').classList.toggle('show',state.clothes.length===0);
  if(state.clothes.length===0)return;
  items.forEach(item=>{ const card=document.createElement('article');card.className='library-card';card.innerHTML=`<div class="library-photo"><img src="${item.image}" alt="${escapeHtml(item.name)}"><div class="library-actions"><button data-action="edit" title="Edit item">✎</button><button data-action="delete" title="Delete item">×</button></div></div><div class="library-info"><strong>${escapeHtml(item.name)}</strong><span>${categoryLabel(item.category)}${item.note?` · ${escapeHtml(item.note)}`:''}</span></div>`;card.querySelector('[data-action="edit"]').onclick=()=>editItem(item.id);card.querySelector('[data-action="delete"]').onclick=()=>deleteItem(item.id);host.append(card); });
  if(!items.length)host.innerHTML='<p class="empty-filter">Nothing in this category yet.</p>';
}
function renderFits() {
  const host=$('fitGrid');host.innerHTML='';$('fitEmpty').classList.toggle('show',state.fits.length===0);
  state.fits.forEach(fit=>{const card=document.createElement('article');card.className='fit-card';const images=fit.items.map(itemId=>state.clothes.find(x=>x.id===itemId)).filter(Boolean);card.innerHTML=`<div class="fit-preview"><span class="fit-preview-label">FITFOLIO · ${String(fit.number).padStart(3,'0')}</span>${images.slice(0,4).map(x=>`<img src="${x.image}" alt="">`).join('')}</div><div class="fit-card-info"><div><strong>${escapeHtml(fit.name)}</strong><small>${new Date(fit.created).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · ${fit.items.length} piece${fit.items.length===1?'':'s'}</small></div><div class="fit-card-actions"><button data-action="load">Open</button><button data-action="export">Export</button><button data-action="share">Share</button></div></div>`;card.querySelector('[data-action="load"]').onclick=()=>loadFit(fit.id);card.querySelector('[data-action="export"]').onclick=()=>exportFit(fit);card.querySelector('[data-action="share"]').onclick=()=>shareFit(fit);host.append(card);});
}
function renderBoard() {
  const host=$('boardItems');host.innerHTML='';$('board').classList.toggle('has-items',state.board.length>0);$('boardHint').style.display=state.board.length?'none':'block';
  $('lookNumber').textContent=String(state.fits.length+1).padStart(3,'0');
  state.board.forEach((entry,index)=>{const item=state.clothes.find(x=>x.id===entry.id);if(!item)return;const img=document.createElement('img');img.className='board-item';img.src=item.image;img.alt=item.name;img.draggable=false;img.style.left=`${entry.x}%`;img.style.top=`${entry.y}%`;img.style.width=`${entry.size||115}px`;img.style.transform='translate(-50%,-50%)';img.classList.toggle('selected',state.selectedItem===index);img.onpointerdown=e=>beginDrag(e,index,img);img.ondblclick=()=>{state.board.splice(index,1);state.selectedItem=null;renderBoard();};host.append(img);});
}
function addToBoard(id) { const offsets=[[42,39],[60,42],[44,63],[62,67],[52,28]];const p=offsets[state.board.length%offsets.length];state.board.push({id,x:p[0],y:p[1],size:118});state.selectedItem=state.board.length-1;renderBoard();showToast('Added to your look. Drag it into place.'); }
let drag=null;
function beginDrag(e,index,node) { e.preventDefault(); const rect=$('board').getBoundingClientRect();drag={index,node,rect};state.selectedItem=index;node.classList.add('selected');node.setPointerCapture(e.pointerId);node.onpointermove=ev=>{if(!drag)return;const x=Math.max(5,Math.min(95,(ev.clientX-rect.left)/rect.width*100));const y=Math.max(7,Math.min(92,(ev.clientY-rect.top)/rect.height*100));state.board[index].x=x;state.board[index].y=y;node.style.left=`${x}%`;node.style.top=`${y}%`;};node.onpointerup=()=>{drag=null;node.onpointermove=null;}; }
function openAdd() { state.currentImage=null;state.activeEdit=null;$('itemForm').reset();$('photoPreview').classList.remove('has-image');$('photoPreview').style.backgroundImage='';$('saveItem').disabled=true;$('itemDialog').showModal(); }
function readImage(file) { return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=reader.result;};reader.onerror=reject;reader.readAsDataURL(file);}); }
async function prepareImage(file) {
  if(!file||!file.type.startsWith('image/'))return;
  try { const img=await readImage(file);const scale=Math.min(1,1200/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);state.currentImage=canvas.toDataURL('image/jpeg',.84);$('photoPreview').classList.add('has-image');$('photoPreview').style.backgroundImage=`url("${state.currentImage}")`;$('photoPreview').querySelectorAll('span,small').forEach(x=>x.style.display='none');$('saveItem').disabled=false;$('itemName').focus(); }
  catch { showToast('Could not open that photo. Try another one.'); }
}
function editItem(id) {const item=state.clothes.find(x=>x.id===id);if(!item)return;state.activeEdit=id;state.currentImage=item.image;$('itemName').value=item.name;$('itemCategory').value=item.category;$('itemNote').value=item.note||'';$('photoPreview').classList.add('has-image');$('photoPreview').style.backgroundImage=`url("${item.image}")`;$('photoPreview').querySelectorAll('span,small').forEach(x=>x.style.display='none');$('saveItem').disabled=false;itemDialog.showModal();}
function saveItem(e) {e.preventDefault();const editing=Boolean(state.activeEdit);const name=$('itemName').value.trim();if(!name||!state.currentImage)return;const item={id:state.activeEdit||crypto.randomUUID(),name,category:$('itemCategory').value,note:$('itemNote').value.trim(),image:state.currentImage,created:Date.now()};if(editing){state.clothes=state.clothes.map(x=>x.id===state.activeEdit?item:x);}else state.clothes.unshift(item);persist();render();itemDialog.close();if(!editing){removeDialog.showModal();$('removePreview').innerHTML=`<img src="${item.image}" alt="Photo preview">`;state.pendingCutout=item.id;}else showToast('Wardrobe piece updated.');}
function removeBackgroundFrom(dataURL) {return new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const {data,width,height}=ctx.getImageData(0,0,c.width,c.height);const sample=(x,y)=>{const i=(Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*4;return [data[i],data[i+1],data[i+2]];};const points=[[1,1],[width-2,1],[1,height-2],[width-2,height-2],[Math.floor(width/2),1],[Math.floor(width/2),height-2],[1,Math.floor(height/2)],[width-2,Math.floor(height/2)]];const bg=points.map(([x,y])=>sample(x,y)).reduce((acc,v)=>acc.map((n,i)=>n+v[i]/points.length),[0,0,0]);const tolerance=53;const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;const push=(x,y)=>{if(x<0||y<0||x>=width||y>=height)return;const p=y*width+x;if(seen[p])return;const i=p*4,r=data[i],g=data[i+1],b=data[i+2],dist=Math.sqrt((r-bg[0])**2+(g-bg[1])**2+(b-bg[2])**2);if(dist<tolerance&&Math.max(r,g,b)-Math.min(r,g,b)<95){seen[p]=1;queue[tail++]=p;}};for(const [x,y]of points)push(x,y);while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);data[p*4+3]=0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}for(let p=0;p<width*height;p++){if(seen[p])continue;const i=p*4;const dist=Math.sqrt((data[i]-bg[0])**2+(data[i+1]-bg[1])**2+(data[i+2]-bg[2])**2);if(dist<tolerance*.6&&Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])<45)data[i+3]=Math.min(data[i+3],100);}resolve(c.toDataURL('image/png'));};img.src=dataURL;});}
function deleteItem(id) { if(!confirm('Remove this piece from your wardrobe?'))return;state.clothes=state.clothes.filter(x=>x.id!==id);state.board=state.board.filter(x=>x.id!==id);persist();render();showToast('Piece removed from your wardrobe.'); }
function saveFit() {if(!state.board.length){showToast('Add a few pieces to the board first.');return;}$('fitNameInput').value=$('lookName').textContent==='Untitled look'?'':$('lookName').textContent;$('nameDialog').showModal();}
function commitFit(e) {e.preventDefault();const name=$('fitNameInput').value.trim();if(!name)return;const fit={id:crypto.randomUUID(),name,created:Date.now(),number:state.fits.length+1,items:state.board.map(x=>x.id),layout:state.board.map(x=>({...x}))};state.fits.unshift(fit);persist();render();$('nameDialog').close();$('lookName').textContent=name;showToast('Saved to your fitfolio.');}
function loadFit(id) {const fit=state.fits.find(x=>x.id===id);if(!fit)return;state.board=fit.layout?.map(x=>({...x}))||fit.items.map((id,i)=>({id,x:42+i*8,y:43+i*5,size:118}));$('lookName').textContent=fit.name;renderBoard();setView('studio');showToast(`Opened “${fit.name}” in the studio.`);}
function clearBoard() {state.board=[];state.selectedItem=null;$('lookName').textContent='Untitled look';renderBoard();}
function createFitCanvas(fit=null) {
  const layout=fit?.layout||state.board;
  if(!layout.length){showToast('Add pieces to the board first.');return Promise.resolve(null);}
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f0f1eb';ctx.fillRect(0,0,1000,1000);
  const images=layout.map(entry=>({entry,item:state.clothes.find(x=>x.id===entry.id)})).filter(x=>x.item);
  if(!images.length){showToast('Those pieces are no longer in your wardrobe.');return Promise.resolve(null);}
  return Promise.all(images.map(({entry,item})=>new Promise(resolve=>{const img=new Image();img.onload=()=>{const scale=Math.min((entry.size||118)/img.width,190/img.height);ctx.drawImage(img,entry.x/100*1000-img.width*scale/2,entry.y/100*1000-img.height*scale/2,img.width*scale,img.height*scale);resolve();};img.onerror=resolve;img.src=item.image;}))).then(()=>canvas);
}
function exportFit(fit=null) {
  createFitCanvas(fit).then(canvas=>{if(!canvas)return;const a=document.createElement('a');a.download=`fitfolio-${(fit?.name||'look').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`;a.href=canvas.toDataURL('image/png');a.click();showToast('Fit image saved to your device.');});
}
async function shareFit(fit) {
  if(!navigator.share){exportFit(fit);showToast('Sharing is unavailable here, so the image was downloaded.');return;}
  try {
    const canvas=await createFitCanvas(fit);if(!canvas)return;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob){exportFit(fit);return;}
    const file=new File([blob],`fitfolio-${(fit.name||'look').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`,{type:'image/png'});
    if(navigator.canShare&&!navigator.canShare({files:[file]})){exportFit(fit);showToast('Image downloaded. You can share it from your photos.');return;}
    await navigator.share({files:[file],title:fit.name,text:'My Fitfolio look'});showToast('Fit shared.');
  } catch(error) { if(error.name!=='AbortError'){exportFit(fit);} }
}
function downloadCurrent() {exportFit();}
function wireCategories(root,property) {root.querySelectorAll('.category').forEach(btn=>btn.onclick=()=>{root.querySelectorAll('.category').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state[property]=btn.dataset.category;property==='category'?renderStudioWardrobe():renderLibrary();});}

document.querySelectorAll('.nav-item').forEach(btn=>btn.onclick=()=>setView(btn.dataset.view));
$('addClothesButton').onclick=openAdd;$('firstAddButton').onclick=openAdd;$('wardrobeAdd').onclick=openAdd;$('emptyAdd').onclick=openAdd;$('photoPreview').onclick=()=>{photoInput.removeAttribute('capture');photoInput.click();};
photoInput.onchange=e=>{prepareImage(e.target.files?.[0]);e.target.value='';};
$('itemForm').addEventListener('submit',saveItem);$('nameForm').addEventListener('submit',commitFit);
$('removeBackground').onclick=async()=>{const item=state.clothes.find(x=>x.id===state.pendingCutout);if(!item)return;const button=$('removeBackground');button.disabled=true;button.textContent='Working on it…';try{item.image=await removeBackgroundFrom(item.image);persist();render();$('removePreview').innerHTML=`<img src="${item.image}" alt="Background removed preview">`;button.textContent='Background removed ✓';setTimeout(()=>removeDialog.close(),650);showToast('Background cleaned up.');}catch{showToast('Could not clean up this background.');removeDialog.close();}finally{button.disabled=false;button.innerHTML='Remove background <span>✳</span>';}};
$('keepOriginal').onclick=()=>removeDialog.close();$('saveFitButton').onclick=saveFit;$('renameLook').onclick=()=>{const name=prompt('Name this look', $('lookName').textContent==='Untitled look'?'':$('lookName').textContent);if(name?.trim())$('lookName').textContent=name.trim();};$('clearBoard').onclick=clearBoard;$('downloadFit').onclick=downloadCurrent;$('goWardrobe').onclick=()=>setView('wardrobe');$('newLook').onclick=()=>{clearBoard();setView('studio');};$('startStyling').onclick=()=>setView('studio');$('helpButton').onclick=()=>$('aboutDialog').showModal();
wireCategories($('categoryRow'),'category');wireCategories($('wardrobeCategories'),'libraryCategory');
load();render();
$('takePhoto').onclick=()=> $('cameraInput').click();
$('cameraInput').onchange=e=>{prepareImage(e.target.files?.[0]);e.target.value='';};
itemDialog.addEventListener('close',()=>{$('photoPreview').querySelectorAll('span,small').forEach(x=>x.style.display='');});
