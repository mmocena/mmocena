/**

- BODYSCAN — app.js
- Responsabilidade: UI, fluxo de navegação, câmera
- Fases implementadas: 1 (UI) + 2 (Câmera)
  */

'use strict';

/* 
ESTADO GLOBAL DA APLICAÇÃO
 */
const AppState = {
stream: null,
facingMode: 'user',          // 'user' = frontal, 'environment' = traseira
currentMode: 'front',        // 'front' | 'side'
images: {
front: null,               // ImageData ou dataURL
side: null,
},
height: null,
weight: null,
sex: 'male',
cameraActive: false,
processing: false,
};

/* 
REFS DOS ELEMENTOS DOM
 */
const UI = {
// Header
statusIndicator: document.getElementById('statusIndicator'),
statusLabel:     document.getElementById('statusLabel'),

// Inputs
heightInput: document.getElementById('heightInput'),
weightInput: document.getElementById('weightInput'),
btnMale:     document.getElementById('btnMale'),
btnFemale:   document.getElementById('btnFemale'),

// Checklist
checkHeight: document.getElementById('checkHeight'),
checkFront:  document.getElementById('checkFront'),
checkSide:   document.getElementById('checkSide'),

// Botão processar
btnProcess: document.getElementById('btnProcess'),
btnLoader:  document.getElementById('btnLoader'),

// Câmera
videoFeed:          document.getElementById('videoFeed'),
captureCanvas:      document.getElementById('captureCanvas'),
cameraViewport:     document.getElementById('cameraViewport'),
cameraPlaceholder:  document.getElementById('cameraPlaceholder'),
bodyOverlay:        document.getElementById('bodyOverlay'),
scanLine:           document.getElementById('scanLine'),
modeBadge:          document.getElementById('modeBadge'),
overlayInstruction: document.getElementById('overlayInstruction'),

btnStartCamera:   document.getElementById('btnStartCamera'),
btnCaptureFront:  document.getElementById('btnCaptureFront'),
btnCaptureSide:   document.getElementById('btnCaptureSide'),
btnFlipCamera:    document.getElementById('btnFlipCamera'),

tabFront: document.getElementById('tabFront'),
tabSide:  document.getElementById('tabSide'),

// Previews
previewFrontCanvas: document.getElementById('previewFrontCanvas'),
previewSideCanvas:  document.getElementById('previewSideCanvas'),
previewFrontEmpty:  document.getElementById('previewFrontEmpty'),
previewSideEmpty:   document.getElementById('previewSideEmpty'),
previewFrontFrame:  document.getElementById('previewFrontFrame'),
previewSideFrame:   document.getElementById('previewSideFrame'),
previewFrontStatus: document.getElementById('previewFrontStatus'),
previewSideStatus:  document.getElementById('previewSideStatus'),

// Resultados
resultsPlaceholder:   document.getElementById('resultsPlaceholder'),
resultsGrid:          document.getElementById('resultsGrid'),
processingProgress:   document.getElementById('processingProgress'),

resultWaist:    document.getElementById('resultWaist'),
resultChest:    document.getElementById('resultChest'),
resultHip:      document.getElementById('resultHip'),
resultNeck:     document.getElementById('resultNeck'),
resultBodyfat:  document.getElementById('resultBodyfat'),
resultLeanmass: document.getElementById('resultLeanmass'),

// Steps de progresso
step1: document.getElementById('step1'),
step2: document.getElementById('step2'),
step3: document.getElementById('step3'),
step4: document.getElementById('step4'),
step5: document.getElementById('step5'),

// Toast
toastContainer: document.getElementById('toastContainer'),
};

/* 
INICIALIZAÇÃO
 */
function init() {
bindEvents();
updateChecklist();
setStatus('AGUARDANDO', '');
}

/* 
BIND DE EVENTOS
 */
function bindEvents() {
// Inputs de dados
UI.heightInput.addEventListener('input', onHeightChange);
UI.weightInput.addEventListener('input', onWeightChange);

// Seleção de sexo
UI.btnMale.addEventListener('click', () => setSex('male'));
UI.btnFemale.addEventListener('click', () => setSex('female'));

// Câmera
UI.btnStartCamera.addEventListener('click', toggleCamera);
UI.btnCaptureFront.addEventListener('click', () => captureImage('front'));
UI.btnCaptureSide.addEventListener('click', () => captureImage('side'));
UI.btnFlipCamera.addEventListener('click', flipCamera);

// Tabs de modo
UI.tabFront.addEventListener('click', () => setMode('front'));
UI.tabSide.addEventListener('click', () => setMode('side'));

// Processar
UI.btnProcess.addEventListener('click', onProcess);
}

/* 
HANDLERS DE INPUT
 */
function onHeightChange() {
const val = parseFloat(UI.heightInput.value);
if (val >= 100 && val <= 250) {
AppState.height = val;
UI.heightInput.classList.add('valid');
} else {
AppState.height = null;
UI.heightInput.classList.remove('valid');
}
updateChecklist();
}

function onWeightChange() {
const val = parseFloat(UI.weightInput.value);
AppState.weight = (val >= 30 && val <= 300) ? val : null;
}

function setSex(sex) {
AppState.sex = sex;
UI.btnMale.classList.toggle('active', sex === 'male');
UI.btnFemale.classList.toggle('active', sex === 'female');
}

/* 
MODO (FRONTAL / LATERAL)
 */
function setMode(mode) {
AppState.currentMode = mode;
UI.tabFront.classList.toggle('active', mode === 'front');
UI.tabSide.classList.toggle('active', mode === 'side');
UI.modeBadge.textContent = mode === 'front' ? '● FRONTAL' : '● LATERAL';
UI.overlayInstruction.textContent = mode === 'front'
    ? 'Fique de frente para a camera'
    : 'Fique de lado para a camera (perfil direito)';
}

/* 
CÂMERA
 */
async function toggleCamera() {
if (AppState.cameraActive) {
stopCamera();
} else {
await startCamera();
}
}

async function startCamera() {
try {
setStatus('INICIANDO CÂMERA', 'active');
UI.btnStartCamera.textContent = '⏳ AGUARDE…';
UI.btnStartCamera.disabled = true;

 
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: AppState.facingMode,
    width:  { ideal: 720 },
    height: { ideal: 960 }
  },
  audio: false
});

AppState.stream = stream;
AppState.cameraActive = true;

UI.videoFeed.srcObject = stream;
UI.videoFeed.classList.add('active');
UI.cameraPlaceholder.classList.add('hidden');
UI.bodyOverlay.classList.add('active');
UI.scanLine.classList.add('active');
UI.modeBadge.classList.add('active');

// Inicializar badge com modo atual
setMode(AppState.currentMode);

UI.btnStartCamera.textContent = '⏹ PARAR CÂMERA';
UI.btnStartCamera.disabled = false;
UI.btnStartCamera.classList.add('active');
UI.btnCaptureFront.disabled = false;
UI.btnCaptureSide.disabled = false;
UI.btnFlipCamera.disabled = false;

setStatus('CÂMERA ATIVA', 'active');
showToast('Câmera iniciada com sucesso', 'success');
 

} catch (err) {
console.error('Erro ao acessar câmera:', err);
UI.btnStartCamera.textContent = '⏻ INICIAR CÂMERA';
UI.btnStartCamera.disabled = false;
setStatus('ERRO', 'error');

 
if (err.name === 'NotAllowedError') {
  showToast('Permissão de câmera negada. Habilite nas configurações do navegador.', 'error');
} else if (err.name === 'NotFoundError') {
  showToast('Nenhuma câmera encontrada no dispositivo.', 'error');
} else {
  showToast('Erro ao iniciar câmera: ' + err.message, 'error');
}
 

}
}

function stopCamera() {
if (AppState.stream) {
AppState.stream.getTracks().forEach(t => t.stop());
AppState.stream = null;
}

AppState.cameraActive = false;
UI.videoFeed.srcObject = null;
UI.videoFeed.classList.remove('active');
UI.cameraPlaceholder.classList.remove('hidden');
UI.bodyOverlay.classList.remove('active');
UI.scanLine.classList.remove('active');
UI.modeBadge.classList.remove('active');

UI.btnStartCamera.textContent = '⏻ INICIAR CÂMERA';
UI.btnStartCamera.classList.remove('active');
UI.btnCaptureFront.disabled = true;
UI.btnCaptureSide.disabled = true;
UI.btnFlipCamera.disabled = true;

setStatus('CÂMERA PARADA', '');
}

async function flipCamera() {
AppState.facingMode = AppState.facingMode === 'user' ? 'environment' : 'user';
if (AppState.cameraActive) {
stopCamera();
await startCamera();
}
}

/* 
CAPTURA DE IMAGEM
 */
function captureImage(mode) {
if (!AppState.cameraActive) {
showToast('Inicie a câmera primeiro', 'warning');
return;
}

const video   = UI.videoFeed;
const canvas  = UI.captureCanvas;

// Reduzir resolução para ~720px (Fase 12)
const MAX_DIM = 720;
const vw = video.videoWidth;
const vh = video.videoHeight;
const scale = Math.min(MAX_DIM / vw, MAX_DIM / vh, 1);

canvas.width  = Math.round(vw * scale);
canvas.height = Math.round(vh * scale);

const ctx = canvas.getContext('2d');
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

// Salvar como dataURL
const dataURL = canvas.toDataURL('image/jpeg', 0.85);
AppState.images[mode] = dataURL;

// Mostrar preview
showPreview(mode, canvas);

// Flash visual
triggerCaptureFlash();

// Atualizar UI
if (mode === 'front') {
UI.btnCaptureFront.classList.add('captured');
UI.btnCaptureFront.innerHTML = '<span class="capture-ring"></span> ✓ FRONTAL OK';
showToast('Foto frontal capturada!', 'success');
} else {
UI.btnCaptureSide.classList.add('captured');
UI.btnCaptureSide.innerHTML = '<span class="capture-ring"></span> ✓ LATERAL OK';
showToast('Foto lateral capturada!', 'success');
}

updateChecklist();
}

function showPreview(mode, sourceCanvas) {
const previewCanvas = mode === 'front' ? UI.previewFrontCanvas : UI.previewSideCanvas;
const emptyEl       = mode === 'front' ? UI.previewFrontEmpty : UI.previewSideEmpty;
const frameEl       = mode === 'front' ? UI.previewFrontFrame : UI.previewSideFrame;
const statusEl      = mode === 'front' ? UI.previewFrontStatus : UI.previewSideStatus;

// Copiar canvas capturado para preview
previewCanvas.width  = sourceCanvas.width;
previewCanvas.height = sourceCanvas.height;
const ctx = previewCanvas.getContext('2d');
ctx.drawImage(sourceCanvas, 0, 0);

previewCanvas.classList.add('visible');
emptyEl.style.display = 'none';
frameEl.classList.add('has-image');
statusEl.textContent = '✓ Capturada';
statusEl.classList.add('ok');
}

function triggerCaptureFlash() {
const flash = document.createElement('div');
flash.className = 'capture-flash';
document.body.appendChild(flash);
setTimeout(() => flash.remove(), 400);
}

/* 
CHECKLIST / VALIDAÇÃO
 */
function updateChecklist() {
setCheck(UI.checkHeight, !!AppState.height);
setCheck(UI.checkFront,  !!AppState.images.front);
setCheck(UI.checkSide,   !!AppState.images.side);

const allDone = AppState.height && AppState.images.front && AppState.images.side;
UI.btnProcess.disabled = !allDone;
}

function setCheck(el, done) {
el.classList.toggle('done', done);
el.querySelector('.check-icon').textContent = done ? '●' : '○';
}

/* 
PROCESSAMENTO (chamará bodyProcessor.js)
 */
async function onProcess() {
if (AppState.processing) return;

// Validação (Fase 11)
if (!AppState.height) {
showToast('Informe sua altura antes de processar', 'warning');
UI.heightInput.focus();
return;
}
if (!AppState.images.front) {
showToast('Capture a foto frontal primeiro', 'warning');
return;
}
if (!AppState.images.side) {
showToast('Capture a foto lateral primeiro', 'warning');
return;
}

AppState.processing = true;
UI.btnProcess.disabled = true;
UI.btnProcess.classList.add('processing');

// Mostrar painel de progresso
UI.resultsPlaceholder.style.display = 'none';
UI.resultsGrid.style.display = 'none';
UI.processingProgress.style.display = 'block';

setStatus('PROCESSANDO', 'active');

try {
// Chamar o processador (bodyProcessor.js — Fases 4-10)
const results = await BodyProcessor.process({
frontImage: AppState.images.front,
sideImage:  AppState.images.side,
height:     AppState.height,
weight:     AppState.weight,
sex:        AppState.sex,
onStep: updateProgressStep,
});

 
showResults(results);
setStatus('ANÁLISE COMPLETA', 'success');
showToast('Análise concluída com sucesso!', 'success');
 

} catch (err) {
console.error('Erro no processamento:', err);
setStatus('ERRO NO PROCESSAMENTO', 'error');
showToast('Erro: ' + err.message, 'error');
UI.resultsPlaceholder.style.display = 'flex';
UI.processingProgress.style.display = 'none';
} finally {
AppState.processing = false;
UI.btnProcess.disabled = false;
UI.btnProcess.classList.remove('processing');
}
}

function updateProgressStep(stepIndex, state) {
// state: 'active' | 'done'
const steps = [UI.step1, UI.step2, UI.step3, UI.step4, UI.step5];
if (stepIndex < 0 || stepIndex >= steps.length) return;

// Marcar todos anteriores como done
steps.forEach((s, i) => {
if (i < stepIndex)        s.className = 'progress-step done';
else if (i === stepIndex) s.className = 'progress-step ${state}';
else                      s.className = 'progress-step';
});
}

/* 
EXIBIÇÃO DE RESULTADOS
 */
function showResults(results) {
UI.processingProgress.style.display = 'none';
UI.resultsGrid.style.display = 'grid';

// Preencher valores com animação escalonada
const fields = [
{ el: UI.resultWaist,    value: results.waist,    unit: 'cm'  },
{ el: UI.resultChest,    value: results.chest,    unit: 'cm'  },
{ el: UI.resultHip,      value: results.hip,      unit: 'cm'  },
{ el: UI.resultNeck,     value: results.neck,     unit: 'cm'  },
{ el: UI.resultBodyfat,  value: results.bodyFat,  unit: '%'   },
{ el: UI.resultLeanmass, value: results.leanMass, unit: 'kg'  },
];

fields.forEach(({ el, value }, i) => {
setTimeout(() => {
el.textContent = value !== null && value !== undefined
? (typeof value === 'number' ? value.toFixed(1) : value)
: '—';
el.closest('.result-card').classList.add('loaded');
}, i * 120);
});
}

/* 
STATUS DO HEADER
 */
function setStatus(label, type) {
UI.statusLabel.textContent = label;
UI.statusIndicator.className = 'status-indicator';
if (type) UI.statusIndicator.classList.add(type);
}

/* 
TOAST NOTIFICATIONS
 */
function showToast(message, type) {
  if (!type) type = "info";
  var icons = { success: "OK", error: "X", warning: "!", info: "i" };
  var icon = icons[type] || "i";
  var toast = document.createElement("div");
  toast.className = "toast " + type;
  var span1 = document.createElement("span");
  span1.className = "toast-icon";
  span1.textContent = icon;
  var span2 = document.createElement("span");
  span2.textContent = message;
  toast.appendChild(span1);
  toast.appendChild(span2);
  UI.toastContainer.appendChild(toast);
  setTimeout(function() {
    toast.style.animation = "toast-out 0.3s ease forwards";
    setTimeout(function() { toast.remove(); }, 300);
  }, 3500);
}

/* 
INICIAR
 */
init();
/*document.addEventListener('DOMContentLoaded', init);*/
