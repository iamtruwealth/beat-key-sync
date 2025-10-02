# Step 1: Build the app
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ \
    && ln -sf python3 /usr/bin/python

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