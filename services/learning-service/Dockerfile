# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY services/learning-service ./services/learning-service
RUN npm ci || npm install
RUN npm run prisma:generate --workspace @toeic/learning-service
RUN npm run build --workspace @toeic/common
RUN npm run build --workspace @toeic/learning-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/learning-service/dist ./services/learning-service/dist
COPY --from=builder /app/services/learning-service/prisma ./services/learning-service/prisma
COPY --from=builder /app/services/learning-service/package.json ./services/learning-service/package.json
WORKDIR /app/services/learning-service
EXPOSE 3004
CMD ["node", "dist/main.js"]
