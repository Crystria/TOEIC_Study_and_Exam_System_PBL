# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY services/exam-service ./services/exam-service
RUN npm ci || npm install
RUN npm run prisma:generate --workspace @toeic/exam-service
RUN npm run build --workspace @toeic/common
RUN npm run build --workspace @toeic/exam-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/exam-service/dist ./services/exam-service/dist
COPY --from=builder /app/services/exam-service/prisma ./services/exam-service/prisma
COPY --from=builder /app/services/exam-service/package.json ./services/exam-service/package.json
WORKDIR /app/services/exam-service
EXPOSE 3003
CMD ["node", "dist/main.js"]
