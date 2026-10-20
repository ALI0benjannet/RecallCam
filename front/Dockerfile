# Development image: dependencies and native Node binaries stay in Linux.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE}

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0

WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node . .
RUN mkdir -p /app/.next && chown -R node:node /app

USER node
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
