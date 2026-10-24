# Build the React/Vite frontend and serve the static bundle with nginx.
FROM node:22-alpine AS build

WORKDIR /app

# npm workspaces: the root lockfile covers every workspace, but only the
# frontend and the shared package it imports are installed here (the mobile
# app's Expo/React Native toolchain is not needed to build the web bundle).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY frontend/package.json frontend/
COPY mobile/package.json mobile/
RUN npm ci --workspace frontend

COPY packages/shared/ packages/shared/
COPY frontend/ frontend/
RUN npm run build --workspace frontend


FROM nginx:1.27-alpine

COPY deployment/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 3000
