FROM node:20-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm install --production

COPY server/index.mjs server/messages.json ./

EXPOSE 3004

CMD ["node", "index.mjs"]
