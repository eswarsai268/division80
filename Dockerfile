# Build:  docker build --target api -t samasya-api .   (targets: api | worker | web)
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY worker/package.json worker/
COPY frontend/package.json frontend/
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS api
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/backend ./backend
RUN mkdir -p /data/uploads && chown node:node /data/uploads
ENV UPLOAD_DIR=/data/uploads
USER node
EXPOSE 4000
CMD ["node", "backend/src/server.js"]

FROM node:22-alpine AS worker
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/worker ./worker
USER node
CMD ["node", "worker/src/index.js"]

FROM nginx:1.27-alpine AS web
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
