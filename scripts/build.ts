#!/usr/bin/env ts-node-script

import glob from 'fast-glob';
import esbuild from 'esbuild';
import { Project } from 'ts-morph';

const isWatchMode = process.argv.includes('--watch');

const project = new Project({
  compilerOptions: {
    rootDir: 'src',
    declaration: true,
    emitDeclarationOnly: true,
    declarationDir: 'dist/types',
  },
  tsConfigFilePath: 'tsconfig.json',
  skipAddingFilesFromTsConfig: true,
});

project.addSourceFilesAtPaths(['src/**/*.ts', 'src/**/*.tsx']);

async function emitTypeScriptDeclaration() {
  const diagnostics = project.getPreEmitDiagnostics();

  if (diagnostics.length) {
    console.log(project.formatDiagnosticsWithColorAndContext(diagnostics));
  }

  await project.emit();
}

async function build(format: 'cjs' | 'esm', ext: 'js' | 'mjs', doEmitTypeScriptDeclaration?: boolean) {
  await esbuild.build({
    entryPoints: await glob(['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}']),
    outfile: `dist/${format}/index.${ext}`,
    external: ['react'],
    bundle: true,
    watch: process.argv.includes('--watch')
      ? {
          onRebuild: async (error) => {
            if (error) {
              console.error('watch build failed:', error);
            } else {
              if (doEmitTypeScriptDeclaration) console.clear();
              await Promise.all(project.getSourceFiles().map((sourceFile) => sourceFile.refreshFromFileSystem()));
              if (doEmitTypeScriptDeclaration) await emitTypeScriptDeclaration();
              if (doEmitTypeScriptDeclaration) console.log('Built CJS and ESM bundles.');
            }
          },
        }
      : undefined,
  });
}

(async () => {
  if (isWatchMode) console.clear();
  await emitTypeScriptDeclaration();
  await Promise.all([build('cjs', 'js', true), build('esm', 'js'), build('esm', 'mjs')]);
  console.log('Built CJS and ESM bundles.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
