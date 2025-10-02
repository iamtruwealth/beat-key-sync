# Step 1: Build the app
FROM node:20-alpine AS builder
WORKDIR /app

ARG CACHEBUST=1

# Install build dependencies for native modules, print debug info about python binaries and symlinks
RUN apk add --no-cache python3 make g++ && \
    echo "=== PYTHON BINARIES ===" && \
    ls -l /usr/bin/python* && \
    echo "=== WHICH python3 ===" && \
    which python3 && \
    echo "=== WHICH python ===" && \
    which python || true && \
    echo "=== PYTHON3 VERSION ===" && \
    python3 --version && \
    PY3=$(find /usr/bin -name 'python3*' | sort | head -n1) && \
    ln -sf $PY3 /usr/bin/python && \
    echo "=== FINAL PYTHON SYMLINK ===" && \
    ls -l /usr/bin/python

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Serve the build
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
