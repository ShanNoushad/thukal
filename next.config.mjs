/** @type {import('next').NextConfig} */
const nextConfig = {
  // keep these server-only SDKs out of the bundle
  serverExternalPackages: ['firebase-admin', 'cloudinary'],
};

export default nextConfig;
