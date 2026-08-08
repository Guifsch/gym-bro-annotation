import 'dotenv/config';
import mongoose from 'mongoose';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const exercicioSchema = new mongoose.Schema({}, { strict: false });
const Exercicio = mongoose.model('Exercicio', exercicioSchema);

await mongoose.connect(process.env.MONGODB_URI);

const ex = await Exercicio.findOne({ nome: 'Agachamento' });
if (ex?.imagemKey) {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: ex.imagemKey }));
  console.log('Deleted from R2:', ex.imagemKey);
}

ex.imagemUrl = undefined;
ex.imagemKey = undefined;
await ex.save();
console.log('Cleared exercicio image fields');

await mongoose.disconnect();
