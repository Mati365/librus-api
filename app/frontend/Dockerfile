FROM node:20-alpine AS build
WORKDIR /app
COPY app/frontend/package.json app/frontend/package-lock.json ./
RUN npm ci
COPY app/frontend ./
RUN npm run build

FROM nginx:alpine
COPY app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
