docker build --no-cache -t payloadx-backend .

docker run --rm --env-file .env -p 3001:3001 payloadx-backend


docker tag payloadx-backend sundanpatyadsharma/payloadx-backend:latest
docker push sundanpatyadsharma/payloadx-backend:latest
