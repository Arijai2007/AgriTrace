export const SEPOLIA_SAMPLE_ID = 'AGR-DEMO-20261112-001';
export const SEPOLIA_SAMPLE_PATH = '/trace?batch=sepolia-sample';

export function batchLabel(id) {
  return id === SEPOLIA_SAMPLE_ID ? 'Sepolia sample batch' : id;
}

export function tracePath(id) {
  return id === SEPOLIA_SAMPLE_ID ? SEPOLIA_SAMPLE_PATH : '/trace/' + encodeURIComponent(id);
}

export function sampleText(id, text) {
  if (id !== SEPOLIA_SAMPLE_ID || typeof text !== 'string') return text;
  return text
    .replace(/^Classroom demonstration:\s*/, '')
    .replace(/Classroom demonstration (complaint|recall)/g, 'Sample $1')
    .replace(/Classroom demo /gi, 'Sample ');
}
