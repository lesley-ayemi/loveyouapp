import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
// Serve GSAP's ES module build straight from node_modules
app.use('/vendor/gsap', express.static(path.join(__dirname, 'node_modules/gsap')));

app.listen(PORT, () => {
  console.log(`💖 Love app running at http://localhost:${PORT}`);
});
