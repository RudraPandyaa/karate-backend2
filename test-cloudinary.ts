import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'z6esq8yx',
  api_key: '811155878855997',
  api_secret: 'Y_xW0onpJ__DAsOuuqQXelux4Tc',
});

async function test() {
  try {
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful:', result);
  } catch (err: any) {
    console.error('❌ Cloudinary error:', err);
  }
}

test();