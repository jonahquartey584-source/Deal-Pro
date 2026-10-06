FROM node:22-slim
WORKDIR /app
COPY . .
ENV DEALPRO_DATA=/data
CMD ["node","server.mjs"]
