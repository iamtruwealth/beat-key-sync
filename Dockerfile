# Step 1: Build the app
FROM node:20-bullseye AS builder
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    python3 --version && python --version

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Serve the build
FROM node:20-bullseye
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
