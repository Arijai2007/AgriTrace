export const SEPOLIA_SAMPLE_ID = 'AGR-DEMO-20261112-001';
const featuredBatch = 'meerut-tomatoes';

export function featuredBatchId(slug) {
  return slug === featuredBatch || slug === 'sepolia-sample' ? SEPOLIA_SAMPLE_ID : '';
}

export function batchLabel(id) {
  return id === SEPOLIA_SAMPLE_ID ? 'Meerut tomato batch' : id;
}

export function tracePath(id) {
  return id === SEPOLIA_SAMPLE_ID ? '/trace?batch=' + featuredBatch : '/trace/' + encodeURIComponent(id);
}

export function sampleText(id, text) {
  if (id !== SEPOLIA_SAMPLE_ID || typeof text !== 'string') return text;
  const label = text
    .replace(/^Classroom demo /i, '')
    .replace(/^Classroom demonstration(?=[: ])/i, '')
    .replace(/^:\s*/, '')
    .replace(/^\s+/, '')
    .replace(/^Classroom audit/i, 'Audit');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
