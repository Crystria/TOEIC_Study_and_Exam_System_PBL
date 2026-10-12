# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY services/api-gateway ./services/api-gateway
RUN npm ci || npm install
RUN npm run build --workspace @toeic/api-gateway

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/package.json
WORKDIR /app/services/api-gateway
EXPOSE 3000
CMD ["node", "dist/main.js"]
