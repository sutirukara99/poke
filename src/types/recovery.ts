export interface RecoveryManifest {
  version: string;
  source: string;
  recoveredAt: string;
  javascriptAsset: string;
  cssAsset: string;
  javascriptSha256: string;
  cssSha256: string;
}

export interface ActiveBuildManifest {
  version: string;
  source: string;
  javascriptAsset: string;
  designLayer: string;
}
