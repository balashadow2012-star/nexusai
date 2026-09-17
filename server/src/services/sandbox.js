import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import { getDocument, version } from 'pdfjs-dist';
import db from '../db.js';

function chunkText(text, size = 800) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.filter((chunk) => chunk.trim().length > 0);
}

export async function ingestDocument({ documentId, filePath, originalName, mimeType, userId }) {
  const buffer = fs.readFileSync(filePath);
  let extracted = '';

  if (mimeType.includes('text/plain') || originalName.endsWith('.txt') || originalName.endsWith('.csv')) {
    extracted = buffer.toString('utf-8');
  } else if (originalName.endsWith('.docx') || mimeType.includes('officedocument.wordprocessingml')) {
    const result = await mammoth.extractRawText({ buffer });
    extracted = result.value || '';
  } else if (originalName.endsWith('.pdf') || mimeType === 'application/pdf') {
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    let pageText = '';
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item) => item.str || '');
      pageText += strings.join(' ') + '\n';
    }
    extracted = pageText;
  } else if (mimeType.startsWith('image/') || originalName.match(/\.(png|jpg|jpeg|webp)$/i)) {
    const { data } = await Tesseract.recognize(buffer, 'eng');
    extracted = data.text || '';
  }

  if (!extracted.trim()) {
    throw new Error('No readable text could be extracted from the uploaded file.');
  }

  const textChunks = chunkText(extracted);
  const statements = textChunks.map((chunk, index) => ({
    id: randomUUID(),
    documentId,
    chunkIndex: index,
    text: chunk,
    pageNumber: index + 1,
    source: originalName,
    createdAt: new Date().toISOString()
  }));

  const insert = db.prepare('INSERT INTO document_chunks (id, document_id, chunk_index, text, page_number, source) VALUES (?, ?, ?, ?, ?, ?)');
  for (const chunk of statements) {
    insert.run(chunk.id, chunk.documentId, chunk.chunkIndex, chunk.text, chunk.pageNumber, chunk.source);
  }

  return statements;
}

export async function queryDocument({ userId, documentId, query }) {
  const docs = documentId
    ? db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').all(documentId, userId)
    : db.prepare('SELECT * FROM documents WHERE user_id = ?').all(userId);

  if (!docs.length) {
    throw new Error('No matching documents found for this user.');
  }

  const relevant = [];
  for (const doc of docs) {
    const rows = db.prepare('SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index').all(doc.id);
    for (const row of rows) {
      const haystack = `${row.text} ${row.source ?? ''}`.toLowerCase();
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      const matchScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
      if (matchScore > 0) {
        relevant.push({ filename: doc.filename, page: row.page_number, text: row.text, score: matchScore });
      }
    }
  }

  if (!relevant.length) {
    return {
      answer: 'No relevant passages were found in the uploaded documents for that query.',
      sources: []
    };
  }

  relevant.sort((a, b) => b.score - a.score);
  const top = relevant.slice(0, 3);

  return {
    answer: `Based on ${top.length} relevant passages, the answer is: ${top[0].text.slice(0, 250)}...`,
    sources: top.map((entry) => ({ filename: entry.filename, page: entry.page, text: entry.text }))
  };
}
