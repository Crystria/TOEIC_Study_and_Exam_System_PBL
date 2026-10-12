# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY services/auth-service ./services/auth-service
RUN npm ci || npm install
RUN npm run prisma:generate --workspace @toeic/auth-service
RUN npm run build --workspace @toeic/auth-service

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=builder /app/services/auth-service/prisma ./services/auth-service/prisma
COPY --from=builder /app/services/auth-service/package.json ./services/auth-service/package.json
WORKDIR /app/services/auth-service
EXPOSE 3001
CMD ["node", "dist/main.js"]
