/**

- BODYSCAN — bodyProcessor.js
- Responsabilidade: Orquestração da IA (pose detection + segmentação)
- Fases implementadas: ESQUELETO (Fases 4-10 serão adicionadas aqui)
- 
- DEPENDÊNCIAS EXTERNAS (carregadas sob demanda via CDN):
- - TensorFlow.js
- - @tensorflow-models/pose-detection (MediaPipe)
- - @tensorflow-models/body-pix
    */

'use strict';

const BodyProcessor = (() => {

/* 
MODELOS (lazy-loaded)
 */
let _poseDetector = null;
let _bodyPixModel = null;

/* 
FUNÇÃO PRINCIPAL
 */
async function process({ frontImage, sideImage, height, weight, sex, onStep }) {
// onStep(índice, 'active'|'done') → atualiza barra de progresso na UI

 
//  PASSO 1: Carregar modelos de IA 
onStep(0, 'active');
await loadModels();
onStep(0, 'done');

//  PASSO 2: Detectar pose (frontal) 
onStep(1, 'active');
const frontImg = await dataURLToImage(frontImage);
const pose     = await detectPose(frontImg);
onStep(1, 'done');

//  PASSO 3: Segmentar corpo 
onStep(2, 'active');
const frontMask = await segmentBody(frontImg);
let sideMask    = null;

if (sideImage) {
  const sideImg = await dataURLToImage(sideImage);
  sideMask = await segmentBody(sideImg);
}
onStep(2, 'done');

//  PASSO 4: Calcular medidas 
onStep(3, 'active');
const measures = MeasureUtils.extractMeasures({
  pose,
  frontMask,
  sideMask,
  imageHeight: frontImg.height,
  realHeight:  height,
});
onStep(3, 'done');

//  PASSO 5: Calcular composição corporal 
onStep(4, 'active');
const composition = MeasureUtils.calcBodyComposition({
  measures,
  height,
  weight,
  sex,
});
onStep(4, 'done');

return {
  waist:    measures.waist,
  chest:    measures.chest,
  hip:      measures.hip,
  neck:     measures.neck,
  bodyFat:  composition.bodyFat,
  leanMass: composition.leanMass,
};
 

}

/* 
LAZY LOAD DOS MODELOS
 */
async function loadModels() {
  await tf.setBackend("webgl");
  await tf.ready();

  if (!_bodyPixModel) {
    _bodyPixModel = await bodyPix.load({
      architecture: "MobileNetV1",
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2
    });
  }

  if (!_poseDetector) {
    _poseDetector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );
  }
}

/* 
DETECÇÃO DE POSE (Fase 4)
 */
async function detectPose(imageElement) {
if (!_poseDetector) {
throw new Error('Modelo de pose não carregado');
}

 
const poses = await _poseDetector.estimatePoses(imageElement, {
  maxPoses:         1,
  flipHorizontal:   false,
});

if (!poses || poses.length === 0) {
  throw new Error('Nenhuma pose detectada. Certifique-se de estar visível na imagem.');
}

const pose = poses[0];
const keypoints = pose.keypoints;

// Mapear keypoints relevantes pelo nome
const kpMap = {};
keypoints.forEach(kp => { kpMap[kp.name] = kp; });

return {
  raw: pose,
  keypoints: kpMap,
  // Pontos principais (com fallback null)
  nose:         kpMap['nose']          || null,
  leftShoulder: kpMap['left_shoulder'] || null,
  rightShoulder:kpMap['right_shoulder']|| null,
  leftHip:      kpMap['left_hip']      || null,
  rightHip:     kpMap['right_hip']     || null,
  leftKnee:     kpMap['left_knee']     || null,
  rightKnee:    kpMap['right_knee']    || null,
  leftAnkle:    kpMap['left_ankle']    || null,
  rightAnkle:   kpMap['right_ankle']   || null,
};
 

}

/* 
SEGMENTAÇÃO (Fase 5)
 */
async function segmentBody(imageElement) {
if (!_bodyPixModel) {
throw new Error('Modelo BodyPix não carregado');
}

 
const segmentation = await _bodyPixModel.segmentPerson(imageElement, {
  flipHorizontal:       false,
  internalResolution:   'medium',
  segmentationThreshold: 0.6,
});

// Retornar máscara binária + dimensões
return {
  data:   segmentation.data,       // Uint8Array: 1 = corpo, 0 = fundo
  width:  segmentation.width,
  height: segmentation.height,
};
 

}

/* 
UTILITÁRIOS INTERNOS
 */

// Converte dataURL em HTMLImageElement
function dataURLToImage(dataURL) {
return new Promise((resolve, reject) => {
const img = new Image();
img.onload  = () => resolve(img);
img.onerror = () => reject(new Error('Falha ao carregar imagem'));
img.src = dataURL;
});
}

/* 
API PÚBLICA
 */
return { process };

})();
