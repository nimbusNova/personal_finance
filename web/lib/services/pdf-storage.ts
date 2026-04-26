import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync, statSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';

const PDF_STORAGE_PATH = './data/pdfs';
const EXPORTS_PATH = './data/exports';

export function getPdfStoragePath() { return PDF_STORAGE_PATH; }

export function ensureDataDirectories() {
  mkdirSync('./data', { recursive: true });
  mkdirSync(PDF_STORAGE_PATH, { recursive: true });
  mkdirSync(EXPORTS_PATH, { recursive: true });
}

export function sanitizeFilename(filename: string): string {
  let name = basename(filename);
  name = name.replace(/[^\w\s.-]/g, '_');
  name = name.replace(/[_\s]+/g, '_').replace(/^_+|_+$/g, '');
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
  return name;
}

export function generatePdfPath(originalFilename: string) {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dirPath = join(PDF_STORAGE_PATH, year, month);
  mkdirSync(dirPath, { recursive: true });

  const sanitized = sanitizeFilename(originalFilename);
  const namePart = sanitized.slice(0, -4);
  let filePath = join(dirPath, sanitized);
  let counter = 1;
  while (existsSync(filePath)) {
    filePath = join(dirPath, `${namePart}_${counter}.pdf`);
    counter++;
  }
  return { filePath, fileId: uuidv4() };
}

export function savePdfFile(fileContent: Buffer, filePath: string): number {
  ensureDataDirectories();
  writeFileSync(filePath, fileContent);
  return fileContent.length;
}

export function readPdfFile(filePath: string) { return readFileSync(filePath); }

export function deletePdfFile(filePath: string): boolean {
  try { if (existsSync(filePath)) { unlinkSync(filePath); return true; } } catch { /* ignore */ }
  return false;
}

export function getStorageStats() {
  const basePath = getPdfStoragePath();
  let totalSize = 0, totalFiles = 0;
  if (!existsSync(basePath)) return { total_files: 0, total_size_mb: 0, storage_path: basePath };

  function scanDir(dir: string) {
    for (const item of readdirSync(dir)) {
      const fullPath = join(dir, item);
      const s = statSync(fullPath);
      if (s.isDirectory()) scanDir(fullPath);
      else if (item.endsWith('.pdf')) { totalSize += s.size; totalFiles++; }
    }
  }
  try { scanDir(basePath); } catch { /* ignore */ }

  return { total_files: totalFiles, total_size_mb: Math.round((totalSize / (1024 * 1024)) * 100) / 100, storage_path: basePath };
}
