FROM node:18-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN apt-get update && apt-get install -y ca-certificates libnss3 libatk1.0-0 libgtk-3-0 libxss1 libasound2 libx11-xcb1 libgbm1 --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN npm install --production
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/index.js"]
