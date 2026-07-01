// Client-side audio feature extraction helper using WebAudio + Meyda
// Usage example (in browser):
// import { extractFeaturesFromFile } from './featureExtractor'
// const features = await extractFeaturesFromFile(file, {segmentLength: 1.0})
// fetch('/infer-features', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':'Bearer <token>'}, body: JSON.stringify({features, threshold:0.6}) })

import Meyda from 'meyda'
import * as tfjsModel from './tfjsModel'

export async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  const ac = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await ac.decodeAudioData(arrayBuffer)
  return { audioBuffer, audioCtx: ac }
}

export function getSegmentSamples(audioBuffer, segmentLengthSeconds = 1.0) {
  const sr = audioBuffer.sampleRate
  const segmentSamples = Math.floor(segmentLengthSeconds * sr)
  const totalSamples = audioBuffer.length
  const segments = []
  for (let start = 0; start < totalSamples; start += segmentSamples) {
    const end = Math.min(start + segmentSamples, totalSamples)
    // copy into Float32Array
    const segment = audioBuffer.getChannelData(0).slice(start, end)
    // if shorter than segmentSamples, pad with zeros
    if (segment.length < segmentSamples) {
      const padded = new Float32Array(segmentSamples)
      padded.set(segment, 0)
      segments.push(padded)
    } else {
      segments.push(segment)
    }
  }
  return { segments, sr }
}

export function extractFeaturesFromSegment(segment, sr) {
  // Meyda needs a buffer of samples in a Float32Array
  const features = Meyda.extract(['mfcc', 'spectralCentroid', 'zcr'], segment, {
    sampleRate: sr,
    bufferSize: segment.length,
    mfcc: { numberOfCoefficients: 13 },
  })
  // features.mfcc is an array; spectralCentroid is a number or array
  const mfcc = features.mfcc || new Array(13).fill(0)
  const sc = Array.isArray(features.spectralCentroid) ? (features.spectralCentroid[0] || 0) : (features.spectralCentroid || 0)
  const zcr = Array.isArray(features.zcr) ? (features.zcr[0] || 0) : (features.zcr || 0)
  // return vector: mfcc(13) + mean(spectralCentroid) + mean(zcr)
  const out = mfcc.slice(0,13)
  out.push(sc)
  out.push(zcr)
  return out
}

export async function extractFeaturesFromFile(file, opts = {}) {
  const segmentLength = opts.segmentLength || 1.0
  const { audioBuffer } = await decodeAudioFile(file)
  const { segments, sr } = getSegmentSamples(audioBuffer, segmentLength)
  const features = segments.map((seg) => extractFeaturesFromSegment(seg, sr))
  return features
}

export async function sendFeaturesToServer(features, { apiBase = '', token = null, threshold = 0.6 } = {}) {
  const url = (apiBase || '') + '/infer-features'
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ features, threshold }) })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Server returned ${resp.status}: ${txt}`)
  }
  return resp.json()
}

// In-browser inference helper: attempt to use a loaded TF.js model, fall back to server
export async function inferInBrowserOrServer(features, { tfjsModelBase = null, apiBase = '', token = null, threshold = 0.6 } = {}) {
  // If tfjsModelBase is provided, try to load model (if not already loaded)
  if (tfjsModelBase) {
    try {
      if (!tfjsModel.isModelLoaded()) {
        await tfjsModel.loadTfjsModel(tfjsModelBase)
      }
      const probs = await tfjsModel.predictFeatures(features)
      const preds = probs.map((p) => (p >= threshold ? 1 : 0))
      return { probs, preds, threshold, backend: 'tfjs' }
    } catch (err) {
      console.warn('TF.js inference failed, falling back to server:', err)
    }
  }

  // fallback to server
  const resp = await sendFeaturesToServer(features, { apiBase, token, threshold })
  return { probs: resp.probs, preds: resp.preds, threshold: resp.threshold, backend: 'server' }
}
