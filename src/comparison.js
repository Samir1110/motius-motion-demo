/** Match 2–3 catalogs by source index and prompt. Never shift after a missing file. */
export function pairCatalogs(catalogs, labels) {
  if (!Array.isArray(catalogs) || catalogs.length < 2 || catalogs.length > 3)
    throw new Error('Comparison requires two or three motion directories.');
  const normalize = text => String(text ?? '').trim().replace(/\s+/g, ' ');
  const buckets = catalogs.map(catalog => {
    const map = new Map();
    for (const sample of catalog.samples) {
      const key = String(sample.sourceIndex);
      map.set(key, [...(map.get(key) ?? []), sample]);
    }
    return map;
  });
  const skipped = catalogs.flatMap((catalog, index) => catalog.skipped.map(item => ({
    ...item, file: `${String.fromCharCode(65 + index)}: ${item.file}`,
  })));
  const samples = [];
  const used = catalogs.map(() => new Set());
  for (const sample of catalogs[0].samples) {
    const key = String(sample.sourceIndex);
    const matches = buckets.map(bucket => bucket.get(key) ?? []);
    const prompt = normalize(sample.prompt);
    const valid = matches.every(options => options.length === 1) && matches.every(([candidate]) => {
      const other = normalize(candidate?.prompt);
      return prompt && other ? prompt === other : !prompt && !other && sample.fileName === candidate?.fileName;
    });
    if (!valid) {
      skipped.push({file: `A: ${sample.fileName}`, reason: 'No unique sample with the same index and matching prompt in every selected model.'});
      continue;
    }
    matches.forEach(([match], index) => used[index].add(match.id));
    samples.push({...sample, comparison: {models: matches.map(([match], index) => ({
      motion: match.generated,
      label: labels[index] ?? `Model ${String.fromCharCode(65 + index)}`,
      fileName: match.fileName,
      fps: match.fps,
      numFrames: match.numFrames,
      seed: match.seed,
      checkpoint: match.checkpoint,
    }))}});
  }
  catalogs.forEach((catalog, index) => {
    if (!index) return;
    for (const sample of catalog.samples) if (!used[index].has(sample.id)) skipped.push({
      file: `${String.fromCharCode(65 + index)}: ${sample.fileName}`,
      reason: 'Not included in the matched model intersection.',
    });
  });
  return {...catalogs[0], samples, skipped, comparisonMode: true,
    compareDirectories: catalogs.slice(1).map(catalog => catalog.directory),
    tasks: {t2m: samples.map(sample => sample.id)}};
}
