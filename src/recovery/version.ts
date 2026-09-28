export const RECOVERY_BASELINE = {
  version: "0.9.4",
  source: "Opera HTTP cache",
  recoveredAt: "2026-09-28T02:30:00+02:00",
  javascriptAsset: "index-CkLLm7id.js",
  cssAsset: "index-CoKcXii9.css",
  javascriptSha256: "0f2a4c155d47de05eadd996f820b9fe8538e1e959dd4811ae1c6f7d5d68a425e",
  cssSha256: "b43de0091f6fe45df06262136b9d53add6c6cdbf30233b63ef05061e2248813f",
} as const;

export const ACTIVE_BUILD = {
  version: "1.0.0-alpha.1",
  source: "reconstructed from recovered v0.9.4 production bundle",
  javascriptAsset: "recovered/v1.0.0-alpha.1.js",
  designLayer: "src/styles/alpha.css",
} as const;
