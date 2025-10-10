FROM node:22.20-alpine

WORKDIR /app

RUN apk add --no-cache \
    build-base \
    python3 \
    make \
    g++ \
    libc6-compat

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY src/ ./src/

ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]