import * as tf from '@tensorflow/tfjs'

let model = null
let scalerMean = null
let scalerScale = null

export async function loadTfjsModel(baseUrl) {
  // baseUrl should point to the folder that contains model.json and metadata.json
  const modelUrl = `${baseUrl.replace(/\/$/, '')}/model.json`
  const metaUrl = `${baseUrl.replace(/\/$/, '')}/metadata.json`

  try {
    const resp = await fetch(metaUrl)
    if (!resp.ok) throw new Error('metadata not found')
    const meta = await resp.json()
    scalerMean = meta.scaler_mean || null
    scalerScale = meta.scaler_scale || null
  } catch (err) {
    console.warn('TFJS metadata not found or invalid:', err)
  }

  try {
    model = await tf.loadLayersModel(modelUrl)
    return model
  } catch (err) {
    console.warn('Failed to load TFJS model from', modelUrl, err)
    model = null
    throw err
  }
}

export function isModelLoaded() {
  return model !== null
}

export function normalizeFeatures(features) {
  // features: array of arrays
  if (!scalerMean || !scalerScale) return features
  return features.map((row) => row.map((v, i) => (v - (scalerMean[i] || 0)) / (scalerScale[i] || 1)))
}

export async function predictFeatures(features) {
  if (!model) throw new Error('Model not loaded')
  const norm = normalizeFeatures(features)
  const input = tf.tensor2d(norm)
  const out = model.predict(input)
  const data = await out.data()
  input.dispose()
  if (Array.isArray(out)) out.forEach(t => t.dispose())
  else out.dispose()
  return Array.from(data)
}
