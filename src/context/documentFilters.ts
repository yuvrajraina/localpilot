import { statSync } from 'node:fs';
import { basename, extname } from 'node:path';

import type * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import type { DocumentFilterDecision } from './fileContext';

const BLOCKED_SEGMENTS = new Set(['node_modules', 'dist', 'build', 'coverage']);
const BLOCKED_LOCK_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
const BLOCKED_PRIVATE_KEY_NAMES = new Set(['id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519']);
const BLOCKED_EXTENSIONS = new Set(['.pem', '.key']);

export function isDocumentAllowed(document: vscode.TextDocument): boolean {
  return getDocumentFilterDecision(document).allowed;
}

export function getDocumentFilterDecision(document: vscode.TextDocument): DocumentFilterDecision {
  const pathDecision = getPathFilterDecision(document.fileName);

  if (!pathDecision.allowed) {
    return pathDecision;
  }

  const maxFileSizeKb = getConfig().maxFileSizeKb;

  if (isLargeDocument(document, maxFileSizeKb)) {
    return { allowed: false, reason: `Files larger than ${maxFileSizeKb}KB are skipped.` };
  }

  return { allowed: true };
}

export function getPathFilterDecision(fileName: string): DocumentFilterDecision {
  const normalizedPath = fileName.replace(/\\/g, '/');
  const lowerPath = normalizedPath.toLowerCase();
  const lowerBaseName = basename(lowerPath);

  if (isEnvironmentFile(lowerBaseName)) {
    return { allowed: false, reason: 'Environment files are blocked.' };
  }

  if (BLOCKED_LOCK_FILES.has(lowerBaseName)) {
    return { allowed: false, reason: 'Lock files are blocked.' };
  }

  if (BLOCKED_PRIVATE_KEY_NAMES.has(lowerBaseName)) {
    return { allowed: false, reason: 'Private key files are blocked.' };
  }

  if (BLOCKED_EXTENSIONS.has(extname(lowerBaseName))) {
    return { allowed: false, reason: 'Private key and certificate files are blocked.' };
  }

  if (hasBlockedPathSegment(lowerPath)) {
    return { allowed: false, reason: 'Generated and dependency folders are blocked.' };
  }

  if (isMinifiedFileName(lowerBaseName)) {
    return { allowed: false, reason: 'Minified files are blocked.' };
  }

  return { allowed: true };
}

export function isMinifiedFileName(fileName: string): boolean {
  return /\.(min|bundle)\.(js|mjs|cjs|css|html|json|map)$/.test(fileName);
}

function isEnvironmentFile(baseName: string): boolean {
  return baseName === '.env' || baseName.startsWith('.env.');
}

function hasBlockedPathSegment(lowerPath: string): boolean {
  return lowerPath.split('/').some((segment) => BLOCKED_SEGMENTS.has(segment));
}

export function isLargeDocument(document: vscode.TextDocument, maxFileSizeKb = getConfig().maxFileSizeKb): boolean {
  const fileSize = getFileSize(document);

  return fileSize > maxFileSizeKb * 1024;
}

function getFileSize(document: vscode.TextDocument): number {
  if (document.uri.scheme === 'file') {
    try {
      return statSync(document.uri.fsPath).size;
    } catch {
      return Buffer.byteLength(document.getText(), 'utf8');
    }
  }

  return Buffer.byteLength(document.getText(), 'utf8');
}
