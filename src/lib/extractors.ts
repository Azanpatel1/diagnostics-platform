/**
 * Feature extraction algorithms - TypeScript port of Python extractors
 * 
 * All computations are deterministic:
 * - Same input → same output
 * - No random seeds
 * - Fixed numeric tolerances
 * - Ordering does not affect computation
 */

export interface ExtractionResult {
  success: boolean;
  features?: Record<string, number | string | null>;
  error?: string;
}

/**
 * Compute features for timeseries CSV data
 */
export function extractTimeseriesCSV(content: string): ExtractionResult {
  try {
    // Parse CSV
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      return { success: false, error: "CSV file is empty (no data rows)" };
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const channelIdx = header.indexOf('channel');
    const tIdx = header.indexOf('t');
    const yIdx = header.indexOf('y');

    if (channelIdx === -1 || tIdx === -1 || yIdx === -1) {
      const missing = ['channel', 't', 'y'].filter(col => !header.includes(col));
      return { success: false, error: `Missing required columns: ${missing.join(', ')}` };
    }

    // Parse data rows
    const data: { channel: string; t: number; y: number }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length < 3) continue;

      const channel = row[channelIdx]?.trim();
      const t = parseFloat(row[tIdx]);
      const y = parseFloat(row[yIdx]);

      if (channel && !isNaN(t) && !isNaN(y)) {
        data.push({ channel, t, y });
      }
    }

    if (data.length === 0) {
      return { success: false, error: "No valid data after parsing" };
    }

    // Group by channel
    const channelData = new Map<string, { t: number; y: number }[]>();
    for (const row of data) {
      if (!channelData.has(row.channel)) {
        channelData.set(row.channel, []);
      }
      channelData.get(row.channel)!.push({ t: row.t, y: row.y });
    }

    // Sort channels for determinism
    const channels = Array.from(channelData.keys()).sort();

    // Compute features for each channel
    const allFeatures: Record<string, number | string | null> = {};

    for (const channel of channels) {
      const points = channelData.get(channel)!;
      // Sort by time
      points.sort((a, b) => a.t - b.t);
      
      const tArr = points.map(p => p.t);
      const yArr = points.map(p => p.y);

      const channelFeatures = computeTimeseriesFeatures(tArr, yArr, channel);
      Object.assign(allFeatures, channelFeatures);
    }

    // Compute global features
    const globalFeatures = computeGlobalFeatures(allFeatures, channels);
    Object.assign(allFeatures, globalFeatures);

    return { success: true, features: allFeatures };
  } catch (error) {
    return { 
      success: false, 
      error: `Extraction error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Compute features for endpoint JSON data
 */
export function extractEndpointJSON(content: string): ExtractionResult {
  try {
    const data = JSON.parse(content);

    if (typeof data !== 'object' || data === null) {
      return { success: false, error: "JSON root must be an object" };
    }

    if (!('channels' in data)) {
      return { success: false, error: "Missing required field 'channels'" };
    }

    if (!Array.isArray(data.channels)) {
      return { success: false, error: "Field 'channels' must be an array" };
    }

    if (data.channels.length === 0) {
      return { success: false, error: "Field 'channels' must have at least one entry" };
    }

    // Validate and collect channel data
    const channelsData: { channel: string; value: number }[] = [];

    for (let i = 0; i < data.channels.length; i++) {
      const ch = data.channels[i];
      
      if (typeof ch !== 'object' || ch === null) {
        return { success: false, error: `Channel entry ${i} must be an object` };
      }

      if (typeof ch.channel !== 'string') {
        return { success: false, error: `Channel entry ${i} 'channel' must be a string` };
      }

      if (typeof ch.value !== 'number') {
        return { success: false, error: `Channel entry ${i} 'value' must be a number` };
      }

      channelsData.push({ channel: ch.channel, value: ch.value });
    }

    // Sort for determinism
    channelsData.sort((a, b) => a.channel.localeCompare(b.channel));

    // Compute features
    const allFeatures: Record<string, number | string | null> = {};
    const channelNames: string[] = [];

    for (const ch of channelsData) {
      channelNames.push(ch.channel);
      allFeatures[`channel.${ch.channel}.endpoint_value`] = ch.value;
    }

    // Global features
    const globalFeatures = computeGlobalFeatures(allFeatures, channelNames);
    Object.assign(allFeatures, globalFeatures);

    // Include metadata if present
    if (data.metadata && typeof data.metadata === 'object') {
      for (const [key, value] of Object.entries(data.metadata)) {
        if (typeof value === 'number' || typeof value === 'string') {
          allFeatures[`metadata.${key}`] = value;
        }
      }
    }

    return { success: true, features: allFeatures };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: `JSON parsing error: ${error.message}` };
    }
    return { 
      success: false, 
      error: `Extraction error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Compute features for a single channel's time-series data
 */
function computeTimeseriesFeatures(
  t: number[],
  y: number[],
  channel: string
): Record<string, number | null> {
  const prefix = `channel.${channel}`;

  if (t.length === 0 || y.length === 0) {
    return {
      [`${prefix}.baseline_mean`]: null,
      [`${prefix}.baseline_std`]: null,
      [`${prefix}.y_max`]: null,
      [`${prefix}.y_min`]: null,
      [`${prefix}.t_at_max`]: null,
      [`${prefix}.auc`]: null,
      [`${prefix}.slope_early`]: null,
      [`${prefix}.t_halfmax`]: null,
      [`${prefix}.snr`]: null,
    };
  }

  const n = y.length;

  // Baseline calculations (first 10% of samples)
  const baselineN = Math.max(1, Math.floor(n * 0.1));
  const baselineY = y.slice(0, baselineN);
  const baselineMean = mean(baselineY);
  const baselineStd = std(baselineY);

  // Basic statistics
  const yMax = Math.max(...y);
  const yMin = Math.min(...y);

  // Time at max (first occurrence)
  const maxIdx = y.indexOf(yMax);
  const tAtMax = t[maxIdx];

  // AUC - trapezoidal integral
  const auc = trapezoid(y, t);

  // Slope early - linear regression over first 20% of points
  const earlyN = Math.max(2, Math.floor(n * 0.2));
  const earlyT = t.slice(0, earlyN);
  const earlyY = y.slice(0, earlyN);
  const slopeEarly = earlyT.length >= 2 ? linearRegressionSlope(earlyT, earlyY) : 0;

  // t_halfmax - first t where y >= baseline + 0.5*(yMax - baseline)
  const halfmaxThreshold = baselineMean + 0.5 * (yMax - baselineMean);
  let tHalfmax: number | null = null;
  for (let i = 0; i < y.length; i++) {
    if (y[i] >= halfmaxThreshold) {
      tHalfmax = t[i];
      break;
    }
  }

  // SNR - signal to noise ratio
  const snr = (yMax - baselineMean) / Math.max(baselineStd, 1e-9);

  return {
    [`${prefix}.baseline_mean`]: baselineMean,
    [`${prefix}.baseline_std`]: baselineStd,
    [`${prefix}.y_max`]: yMax,
    [`${prefix}.y_min`]: yMin,
    [`${prefix}.t_at_max`]: tAtMax,
    [`${prefix}.auc`]: auc,
    [`${prefix}.slope_early`]: slopeEarly,
    [`${prefix}.t_halfmax`]: tHalfmax,
    [`${prefix}.snr`]: snr,
  };
}

/**
 * Compute global/cross-channel features
 */
function computeGlobalFeatures(
  channelFeatures: Record<string, number | string | null>,
  channels: string[],
  baselineStdThreshold = 10.0,
  snrThreshold = 3.0
): Record<string, number | string> {
  const numChannels = channels.length;

  // Check signal quality
  let lowQuality = false;
  for (const ch of channels) {
    const baselineStd = channelFeatures[`channel.${ch}.baseline_std`];
    const snr = channelFeatures[`channel.${ch}.snr`];

    if (typeof baselineStd === 'number' && baselineStd > baselineStdThreshold) {
      lowQuality = true;
      break;
    }
    if (typeof snr === 'number' && snr < snrThreshold) {
      lowQuality = true;
      break;
    }
  }

  return {
    "global.num_channels": numChannels,
    "global.signal_quality_flag": lowQuality ? "low" : "ok",
  };
}

// Math helper functions

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function trapezoid(y: number[], x: number[]): number {
  if (y.length < 2 || x.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < y.length; i++) {
    sum += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1]);
  }
  return sum;
}

function linearRegressionSlope(x: number[], y: number[]): number {
  if (x.length < 2) return 0;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) return 0;
  
  return (n * sumXY - sumX * sumY) / denominator;
}
