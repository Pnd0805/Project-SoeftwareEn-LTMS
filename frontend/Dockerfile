# Stage 1 Build
FROM node:24-bookworm AS builder
WORKDIR /frontend
COPY package*.json ./
RUN npm ci
COPY . .

ENV VITE_USE_MOCK=false
ENV VITE_API_BASE_URL=/api/v1

RUN npm run build


# Stage 2 nginx 
FROM nginx:1.30.5-alpine
COPY --from=builder /frontend/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
