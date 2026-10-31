// Post-process dist-single/index.html: inline every "images/..." reference as a data URI
import fs from 'fs'; import path from 'path';
const f = 'dist-single/index.html'; let html = fs.readFileSync(f, 'utf8');
const mime = { png: 'image/png', webp: 'image/webp', jfif: 'image/jpeg', jpg: 'image/jpeg', svg: 'image/svg+xml', ico: 'image/x-icon' };
let n = 0;
html = html.replace(/(["'(])\/?(images\/[A-Za-z0-9_./-]+\.(png|webp|jfif|jpg|svg|ico))/g, (m, q, p, ext) => {
  const fp = path.join('public', p); if (!fs.existsSync(fp)) return m;
  n++; return q + `data:${mime[ext]};base64,` + fs.readFileSync(fp).toString('base64');
});
fs.writeFileSync(f, html); console.log('inlined', n, 'image refs;', (html.length / 1e6).toFixed(2), 'MB');
