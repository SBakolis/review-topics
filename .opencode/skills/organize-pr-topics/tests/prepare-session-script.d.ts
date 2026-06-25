declare module "../scripts/prepare-session.mjs" {
  export function parsePrepareSessionArgs(argv: string[]): {
    outputPath?: string;
    prSelector?: string;
  };
  export function buildPrViewArgs(prSelector?: string): string[];
  export function buildPrDiffArgs(prSelector?: string): string[];
}
