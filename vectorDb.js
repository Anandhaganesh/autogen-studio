import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve('db.json');

function dotProduct(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

function magnitude(a) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a, b) {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

export class VectorDb {
  constructor() {
    this.documents = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        this.documents = JSON.parse(data);
        console.log(`[VectorDB] Loaded ${this.documents.length} vectors from ${DB_FILE}`);
      } else {
        this.documents = [];
        console.log(`[VectorDB] Database file not found. Initialized empty.`);
      }
    } catch (error) {
      console.error('[VectorDB] Error loading database:', error);
      this.documents = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.documents, null, 2), 'utf-8');
      console.log(`[VectorDB] Saved ${this.documents.length} vectors to ${DB_FILE}`);
    } catch (error) {
      console.error('[VectorDB] Error saving database:', error);
    }
  }

  addVectors(newDocs) {
    // newDocs is an array of { text, embedding, metadata }
    const items = newDocs.map((doc, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      text: doc.text,
      embedding: doc.embedding,
      metadata: doc.metadata || {}
    }));
    this.documents.push(...items);
    this.save();
    return items.length;
  }

  search(queryEmbedding, topK = 4) {
    if (!queryEmbedding || this.documents.length === 0) return [];

    const results = this.documents.map(doc => {
      const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
      return {
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        similarity
      };
    });

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  getDocumentsList() {
    // Get unique file names and statistics
    const stats = {};
    this.documents.forEach(doc => {
      const fileName = doc.metadata.fileName || 'Unknown File';
      if (!stats[fileName]) {
        stats[fileName] = {
          fileName,
          chunksCount: 0,
          totalPages: doc.metadata.totalPages || 1,
          uploadDate: doc.metadata.uploadDate || new Date().toISOString()
        };
      }
      stats[fileName].chunksCount++;
      if (doc.metadata.totalPages && doc.metadata.totalPages > stats[fileName].totalPages) {
        stats[fileName].totalPages = doc.metadata.totalPages;
      }
    });

    return Object.values(stats);
  }

  deleteDocument(fileName) {
    this.documents = this.documents.filter(doc => doc.metadata.fileName !== fileName);
    this.save();
    console.log(`[VectorDB] Deleted all vectors associated with document: ${fileName}`);
  }

  clear() {
    this.documents = [];
    this.save();
    console.log('[VectorDB] Database cleared.');
  }
}
