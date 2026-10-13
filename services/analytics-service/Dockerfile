# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY services/analytics-service ./services/analytics-service
RUN npm ci || npm install
RUN npm run prisma:generate --workspace @toeic/analytics-service
RUN npm run build --workspace @toeic/common
RUN npm run build --workspace @toeic/analytics-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/analytics-service/dist ./services/analytics-service/dist
COPY --from=builder /app/services/analytics-service/prisma ./services/analytics-service/prisma
COPY --from=builder /app/services/analytics-service/package.json ./services/analytics-service/package.json
WORKDIR /app/services/analytics-service
EXPOSE 3005
CMD ["node", "dist/main.js"]
