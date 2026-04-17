/**

- BODYSCAN — measureUtils.js
- Responsabilidade: Cálculos de medidas corporais e composição
- Fases implementadas: 6 (escala), 7 (medidas), 8 (circunferência), 9 (gordura)
  */

'use strict';

const MeasureUtils = (() => {

/* 
FASE 6 — ESCALA: pixels → centímetros
 */

/**

- Calcula a escala px→cm com base na altura real e na altura em pixels.
- @param {object} pose         - Resultado de detectPose()
- @param {object} mask         - Máscara binária frontal
- @param {number} realHeightCm - Altura real em cm
- @returns {{ scale: number, headY: number, feetY: number }}
  */
  function calcScale(pose, mask, realHeightCm) {
  // Tentar usar keypoints para detectar topo e base
  let headY = null;
  let feetY = null;

 
// Topo: usar nariz como referência da cabeça
if (pose.nose && pose.nose.score > 0.3) {
  // Cabeça real fica ~15% acima do nariz
  headY = pose.nose.y * 0.85;
}

// Base: média dos tornozelos
const ankles = [pose.leftAnkle, pose.rightAnkle].filter(a => a && a.score > 0.3);
if (ankles.length > 0) {
  feetY = ankles.reduce((sum, a) => sum + a.y, 0) / ankles.length;
}

// Fallback: usar a máscara binária para detectar topo e base
if (headY === null || feetY === null) {
  const bounds = getMaskBounds(mask);
  headY = headY ?? bounds.minY;
  feetY = feetY ?? bounds.maxY;
}

const heightPx = Math.abs(feetY - headY);
if (heightPx < 10) {
  throw new Error('Não foi possível determinar a altura em pixels. Reposicione-se na imagem.');
}

const scale = realHeightCm / heightPx; // cm por pixel

return { scale, headY, feetY, heightPx };
 

}

/**

- Detecta os limites verticais da máscara.
  */
  function getMaskBounds(mask) {
  let minY = Infinity;
  let maxY = -Infinity;

 
for (let y = 0; y < mask.height; y++) {
  for (let x = 0; x < mask.width; x++) {
    if (mask.data[y * mask.width + x] === 1) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
return { minY, maxY };
 

}

/* 
FASE 7 — LARGURA NA MÁSCARA
 */

/**

- Retorna a largura (em pixels) do corpo na linha Y da máscara.
- @param {object} mask - { data, width, height }
- @param {number} y    - Linha a medir
- @returns {number}    - Largura em pixels (0 se vazio)
  */
  function getWidthAtY(mask, y) {
  const row = Math.round(y);
  if (row < 0 || row >= mask.height) return 0;

 
let minX = Infinity;
let maxX = -Infinity;

for (let x = 0; x < mask.width; x++) {
  if (mask.data[row * mask.width + x] === 1) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
}

return minX === Infinity ? 0 : maxX - minX;
 

}

/**

- Retorna a largura média de uma faixa de linhas.
- Ignora zeros (linhas sem corpo detectado).
  */
  function getAvgWidthInRange(mask, yStart, yEnd) {
  const values = [];
  const step = Math.max(1, Math.floor((yEnd - yStart) / 10));
  for (let y = Math.round(yStart); y <= Math.round(yEnd); y += step) {
  const w = getWidthAtY(mask, y);
  if (w > 0) values.push(w);
  }
  if (values.length === 0) return 0;
  // Usar mediana para robustez
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
  }

/* 
FASE 8 — CIRCUNFERÊNCIA (elipse)
 */

/**

- Aproxima a circunferência de uma seção corporal como elipse.
- Circunferência da elipse ≈ π × √(2(a² + b²)) / √2
- Simplificado: π × (a + b) × (1 + 3h / (10 + √(4-3h)))
- onde h = (a-b)² / (a+b)²
- 
- @param {number} widthCm  - Largura (diâmetro maior) em cm
- @param {number} depthCm  - Profundidade (diâmetro menor) em cm
- @returns {number}         - Circunferência estimada em cm
  */
  function ellipseCircumference(widthCm, depthCm) {
  const a = widthCm / 2;
  const b = depthCm / 2;
  const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }

/* 
FASE 7+8 — EXTRAÇÃO COMPLETA DE MEDIDAS
 */

/**

- Extrai todas as medidas corporais a partir da pose + máscaras.
  */
  function extractMeasures({ pose, frontMask, sideMask, imageHeight, realHeight }) {
  //  1. Calcular escala 
  const { scale, headY, feetY, heightPx } = calcScale(pose, frontMask, realHeight);

 
//  2. Calcular Y de referência para cada região (em pixels) 
// Estimar proporções corporais padrão baseadas na altura em pixels
const torsoTop    = headY + heightPx * 0.13;  // início dos ombros (~13% do topo)
const torsoBottom = headY + heightPx * 0.54;  // final do quadril (~54%)

// Peito: ~25% da altura (abaixo do topo)
const chestY  = headY + heightPx * 0.25;
// Cintura: ~40% da altura
const waistY  = headY + heightPx * 0.40;
// Quadril: ~52% da altura
const hipY    = headY + heightPx * 0.52;
// Pescoço: ~14% da altura
const neckY   = headY + heightPx * 0.14;

// Usar keypoints de pose para refinar posições (se disponíveis)
const refinedChest = refineYFromKeypoints(
  pose, ['left_shoulder', 'right_shoulder'], chestY, 0.1
);
const refinedWaist = refineYFromKeypoints(
  pose, ['left_hip', 'right_hip'], waistY, -0.15
);
const refinedHip   = refineYFromKeypoints(
  pose, ['left_hip', 'right_hip'], hipY, 0.02
);

//  3. Larguras (em pixels) da vista frontal 
const chestWidthPx  = getAvgWidthInRange(frontMask, refinedChest - 5,  refinedChest + 5);
const waistWidthPx  = getAvgWidthInRange(frontMask, refinedWaist - 5,  refinedWaist + 5);
const hipWidthPx    = getAvgWidthInRange(frontMask, refinedHip - 5,    refinedHip + 5);
const neckWidthPx   = getAvgWidthInRange(frontMask, neckY - 3,         neckY + 3);

//  4. Profundidades (em pixels) da vista lateral 
let chestDepthPx  = chestWidthPx  * 0.75; // fallback: proporção típica
let waistDepthPx  = waistWidthPx  * 0.60;
let hipDepthPx    = hipWidthPx    * 0.70;
let neckDepthPx   = neckWidthPx   * 0.85;

if (sideMask) {
  // Usar máscara lateral para profundidades reais
  const scaleRatio = sideMask.height / frontMask.height;
  chestDepthPx  = getAvgWidthInRange(sideMask, refinedChest * scaleRatio - 5, refinedChest * scaleRatio + 5) || chestDepthPx;
  waistDepthPx  = getAvgWidthInRange(sideMask, refinedWaist * scaleRatio - 5, refinedWaist * scaleRatio + 5) || waistDepthPx;
  hipDepthPx    = getAvgWidthInRange(sideMask, refinedHip   * scaleRatio - 5, refinedHip   * scaleRatio + 5) || hipDepthPx;
}

//  5. Converter pixels → cm 
const chestWidthCm  = chestWidthPx  * scale;
const waistWidthCm  = waistWidthPx  * scale;
const hipWidthCm    = hipWidthPx    * scale;
const neckWidthCm   = neckWidthPx   * scale;

const chestDepthCm  = chestDepthPx  * scale;
const waistDepthCm  = waistDepthPx  * scale;
const hipDepthCm    = hipDepthPx    * scale;
const neckDepthCm   = neckDepthPx   * scale;

//  6. Calcular circunferências 
const chestCirc  = ellipseCircumference(chestWidthCm, chestDepthCm);
const waistCirc  = ellipseCircumference(waistWidthCm, waistDepthCm);
const hipCirc    = ellipseCircumference(hipWidthCm,   hipDepthCm);
const neckCirc   = ellipseCircumference(neckWidthCm,  neckDepthCm);

return {
  chest: clampMeasure(chestCirc, 60, 180),
  waist: clampMeasure(waistCirc, 50, 180),
  hip:   clampMeasure(hipCirc,   60, 180),
  neck:  clampMeasure(neckCirc,  25, 60),
  // Larguras brutas para debug
  _raw: { chestWidthCm, waistWidthCm, hipWidthCm, neckWidthCm, scale, heightPx },
};
 

}

/**

- Refina a coordenada Y usando keypoints da pose.
- @param {object} pose       - Resultado do detectPose
- @param {string[]} kpNames  - Keypoints a usar
- @param {number} fallback   - Valor Y de fallback
- @param {number} offset     - Fração de ajuste relativo à altura
  */
  function refineYFromKeypoints(pose, kpNames, fallback, offsetFraction) {
  const validKps = kpNames
  .map(name => pose.keypoints[name])
  .filter(kp => kp && kp.score > 0.3);

 
if (validKps.length === 0) return fallback;

const avgY = validKps.reduce((s, kp) => s + kp.y, 0) / validKps.length;
return avgY + avgY * offsetFraction;
 

}

/**

- Limita um valor a um intervalo razoável.
  */
  function clampMeasure(value, min, max) {
  return Math.min(max, Math.max(min, value));
  }

/* 
FASE 9 — COMPOSIÇÃO CORPORAL
Método: Marinha dos EUA (US Navy Method)
 */

/**

- Calcula o percentual de gordura pelo método da Marinha dos EUA.
- 
- Homens:
- %GC = 86.010 × log10(abdômen − pescoço) − 70.041 × log10(altura) + 36.76
- 
- Mulheres:
- %GC = 163.205 × log10(cintura + quadril − pescoço) − 97.684 × log10(altura) − 78.387
- 
- @param {object} measures - { waist, hip, neck }  em cm
- @param {number} height   - Altura em cm
- @param {string} sex      - 'male' | 'female'
- @returns {number}        - Percentual de gordura (%)
  */
  function calcBodyFatNavy(measures, height, sex) {
  const { waist, hip, neck } = measures;
  let bf;

 
if (sex === 'male') {
  // Abdômen ≈ cintura para homens
  const abdomen = waist;
  bf = 86.010 * Math.log10(abdomen - neck) - 70.041 * Math.log10(height) + 36.76;
} else {
  bf = 163.205 * Math.log10(waist + hip - neck) - 97.684 * Math.log10(height) - 78.387;
}

// Limitar a valores fisiologicamente possíveis
return Math.min(50, Math.max(3, bf));
 

}

/**

- Calcula composição corporal completa.
  */
  function calcBodyComposition({ measures, height, weight, sex }) {
  const bodyFat = calcBodyFatNavy(measures, height, sex);

 
let leanMass = null;
if (weight) {
  const fatMass  = (bodyFat / 100) * weight;
  leanMass = weight - fatMass;
}

return {
  bodyFat:  Math.round(bodyFat * 10) / 10,
  leanMass: leanMass !== null ? Math.round(leanMass * 10) / 10 : null,
};
 

}

/* 
API PÚBLICA
 */
return {
extractMeasures,
calcBodyComposition,
calcScale,
getWidthAtY,
ellipseCircumference,
};

})();
