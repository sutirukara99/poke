export interface RecoveryManifest {
  version: string;
  source: string;
  recoveredAt: string;
  javascriptAsset: string;
  cssAsset: string;
  javascriptSha256: string;
  cssSha256: string;
}
