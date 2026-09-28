FROM node:24-bookworm AS builder
WORKDIR /backend
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build


FROM node:24-slim
WORKDIR /backend
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /backend/dist ./dist

USER node
EXPOSE 8000
CMD ["node" , "./dist/server.js"]
