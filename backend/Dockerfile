FROM node:20-alpine AS build
# python3/make/g++: argon2 compila su binario nativo si no hay prebuild para musl.
RUN apk add --no-cache openssl python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build && npx tsc -p tsconfig.seed.json

FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# `prisma` (CLI) está en dependencies para poder ejecutar `migrate deploy` en la imagen.
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
