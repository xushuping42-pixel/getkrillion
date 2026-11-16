import sharp from 'sharp';
await sharp('og.svg').png().toFile('og.png');
await sharp('favicon.svg').resize(180,180).png().toFile('apple-touch-icon.png');
console.log('ok');
