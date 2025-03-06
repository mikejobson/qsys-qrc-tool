# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the library first
RUN npm run build:lib

# Then build the application
RUN npm run build

# Verify the build output
RUN ls -la dist || echo "dist directory not found"

# Production stage
FROM nginx:alpine AS production

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from build stage to nginx serve directory
COPY --from=build /app/dist/web-app/browser /usr/share/nginx/html

# Verify the copied files
RUN ls -la /usr/share/nginx/html || echo "No files copied to nginx directory"

# Copy nginx SPA configuration
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Test nginx configuration
CMD ["nginx", "-g", "daemon off;"]
