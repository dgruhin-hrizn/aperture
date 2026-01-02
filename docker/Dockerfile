FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install
EXPOSE 3456
CMD ["node", "-e", "console.log('Aperture Dockerfile placeholder'); process.exit(1)"]
