FROM node:20-alpine

WORKDIR /app

# Install the library's own runtime dependencies (used by lib/api.js)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib

# Install backend app dependencies (better-sqlite3 needs a C++ toolchain on alpine)
RUN apk add --no-cache python3 make g++
WORKDIR /app/app/backend
COPY app/backend/package.json app/backend/package-lock.json ./
RUN npm ci --omit=dev
COPY app/backend/src ./src

ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "src/server.js"]
