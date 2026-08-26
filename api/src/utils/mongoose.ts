import mongoose from 'mongoose';

import { env } from './env';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongodbUri);
  await dropStaleBodyMetricEntryIndex();
}

/**
 * O índice único de BodyMetricEntry mudou de {userId,date} para {userId,goalId,date}
 * quando a feature virou multi-meta, mas o autoIndex do Mongoose só cria índices
 * novos — nunca derruba os antigos. O índice velho ficava rejeitando qualquer
 * segundo registro na mesma data (mesmo em metas diferentes) como duplicata.
 */
async function dropStaleBodyMetricEntryIndex(): Promise<void> {
  const collection = mongoose.connection.db?.collection('bodymetricentries');
  if (!collection) return;
  try {
    const indexes = await collection.indexes();
    if (indexes.some((idx) => idx.name === 'userId_1_date_1')) {
      await collection.dropIndex('userId_1_date_1');
    }
  } catch {
    // coleção ainda não existe ou índice já foi removido — sem problema
  }
}
