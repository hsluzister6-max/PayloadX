 create docker build 
 docker build --no-cache -t payloadx-backend .

 Test it locally (uses your .env file)
docker run --rm --env-file .env -p 3001:3001 payloadx-backend

Tag & push to Docker Hub
docker tag payloadx-backend sundanpatyadsharma/payloadx-backend:latest
docker push sundanpatyadsharma/payloadx-backend:latest

Redeploy on your server (pull the new image)
docker compose pull && docker compose up -d
