FROM node:22-alpine

WORKDIR /app

# Install server dependencies
COPY package*.json ./
RUN npm install

# Install client dependencies
COPY client/package*.json ./client/
RUN npm --prefix client install

# Copy all source files
COPY . .

# Build the React frontend
RUN npm run build

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "--experimental-sqlite", "server.js"]
