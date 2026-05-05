# PayloadX Backend

Production-ready Node.js backend built with TypeScript, Express, and MongoDB.

## Features

- **Authentication**: Email/Password and Google OAuth 2.0.
- **API Storage**: CRUD operations for projects and API requests.
- **Workflow Engine**: Store and execute complex API workflows.
- **Real-time**: Built-in Socket.IO support for live collaboration.
- **Dockerized**: Multi-stage Docker build to protect source code in production.

## Quick Start (Docker)

1. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in your secrets.
   ```bash
   cp .env.example .env
   ```

2. **Run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```
   The backend will be available at `http://localhost:3001` and MongoDB at `mongodb://localhost:27017`.

## Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run in Development Mode**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

## API Documentation

- **Health Check**: `GET /health`
- **Version**: `GET /version`
- **Auth**: `/api/auth`
- **Projects**: `/api/projects`
- **Requests**: `/api/requests`
- **Workflows**: `/api/workflows`

## Security

- All sensitive routes are protected by JWT authentication.
- Input validation is handled by Zod.
- Production Docker image contains only compiled JavaScript, keeping your TypeScript source code private.
