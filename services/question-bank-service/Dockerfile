# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY services/question-bank-service ./services/question-bank-service
RUN npm ci || npm install
RUN npm run prisma:generate --workspace @toeic/question-bank-service
RUN npm run build --workspace @toeic/question-bank-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/question-bank-service/dist ./services/question-bank-service/dist
COPY --from=builder /app/services/question-bank-service/prisma ./services/question-bank-service/prisma
COPY --from=builder /app/services/question-bank-service/package.json ./services/question-bank-service/package.json
WORKDIR /app/services/question-bank-service
EXPOSE 3002
CMD ["node", "dist/main.js"]
