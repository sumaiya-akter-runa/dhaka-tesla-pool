FROM node:20-alpine

# Prisma's query engine needs OpenSSL, which isn't in the base alpine image.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/server.js"]