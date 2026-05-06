# PayloadX Backend - Docker Setup & Deployment Guide

This guide explains the entire Docker workflow. It is split into two parts: **Part 1** for you (the developer) to build and publish the image, and **Part 2** for your users to pull and run the image on their machines.

---

## Part 1: For You (The Developer)

These steps are for building the latest code and pushing it to Docker Hub so others can access it.

### 1. Build the Docker Image
Whenever you make changes to your backend code, you need to rebuild the image.
Open your terminal, navigate to your backend folder (`/apps/backend`), and run:
```bash
docker build -t sundanpatyadsharma/payloadx-backend:latest .
```

### 2. Push to Docker Hub
Once the build is complete, push the newly built image to your public Docker Hub repository:
```bash
docker push sundanpatyadsharma/payloadx-backend:latest
```

*(Note: Ensure you are logged into Docker Hub locally by running `docker login` before pushing).*

---

## Part 2: For Your Users

Share these instructions with anyone who wants to run your backend on their machine. They do **not** need your source code—only Docker, a `docker-compose.yml` file, and an `.env` file.

### 1. Setup the Directory
Instruct the user to create a new folder anywhere on their computer and open a terminal inside that folder.

### 2. Create the Configuration Files
The user needs to create two files in their new folder:

**File 1: `docker-compose.yml`**
Create a file named exactly `docker-compose.yml` and paste the following into it:
```yaml
services:
  payloadx-backend:
    image: sundanpatyadsharma/payloadx-backend:latest
    container_name: payloadx-backend
    ports:
      - "3001:3001"
    env_file:
      - .env
    restart: unless-stopped
```

**File 2: `.env`**
Create a file named `.env` and fill it with the required environment variables (provide them with an `.env.example` template so they know what values to fill in).

### 3. Pull and Run the Container
Once the two files are in the folder, the user should run the following command in their terminal:
```bash
docker compose up -d
```
Docker will automatically pull the latest image from Docker Hub and start the server in the background.

### 4. Verify it's Running
Users can verify the server is running successfully by checking the logs:
```bash
docker logs payloadx-backend
```

**Advanced Log Commands:**
- **To watch the logs continuously** (like a live feed), add the `-f` flag:
  ```bash
  docker logs -f payloadx-backend
  ```
  *(Press `Ctrl + C` to stop watching)*

- **To see only the last 50 lines** of the logs:
  ```bash
  docker logs --tail 50 payloadx-backend
  ```

Or by checking the health endpoint in their browser or terminal:
```bash
curl http://localhost:3001/health
```

### Stopping the Server
If the user ever needs to stop the server, they can run:
```bash
docker compose down
```
