FROM node:23.4.0

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

EXPOSE 8080

CMD ["pnpm", "start"]
