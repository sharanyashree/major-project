import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, '../dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          login: path.resolve(__dirname, 'login.html'),
          registerUser: path.resolve(__dirname, 'register-user.html'),
          registerDistributor: path.resolve(__dirname, 'register-distributor.html'),
          adminDashboard: path.resolve(__dirname, 'admin-dashboard.html'),
          distributorDashboard: path.resolve(__dirname, 'distributor-dashboard.html'),
          beneficiaryDashboard: path.resolve(__dirname, 'beneficiary-dashboard.html'),
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
