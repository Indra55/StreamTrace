FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY api ./api
COPY engine ./engine
COPY shared ./shared
COPY data ./data
COPY db ./db
COPY scripts ./scripts
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "--experimental-strip-types", "api/server.ts"]
