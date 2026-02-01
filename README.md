# Scaptract

A document extraction and processing application with separate client and server projects.

## Project Structure

```
scaptract/
├── client/          # React client application
├── server/          # Express server application
└── shared/          # Shared TypeScript types
    └── types/
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- MySQL database
- npm or yarn

### Installation

Install dependencies for all projects:

```bash
npm run install:all
```

Or install individually:

```bash
# Client
cd client && npm install

# Server
cd server && npm install
```

### Development

Run both client and server:

```bash
npm run dev:all
```

Or run separately:

```bash
# Client (port 3000)
npm run dev:client

# Server (port 5000)
npm run dev:server
```

### Building

Build both projects:

```bash
npm run build:client
npm run build:server
```

## Project Details

### Client (`client/`)

React application built with:
- Vite
- React Router
- TypeScript
- Tailwind CSS

**Important**: Client code does NOT import any server code. All shared types are in `shared/types/`.

### Server (`server/`)

Express API server with:
- TypeScript
- MySQL
- JWT authentication
- File upload handling

**Important**: Server code does NOT import any client code. All shared types are in `shared/types/`.

### Shared (`shared/`)

Contains TypeScript type definitions shared between client and server:
- `types/index.ts` - All shared interfaces and types

## Environment Variables

### Client

Create `client/.env`:
```
VITE_API_URL=http://localhost:5000
VITE_DEVMODE=false
```

### Server

Create `server/.env`:
```
PORT=5000
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=scaptract
JWT_SECRET=your_jwt_secret
DEVMODE=false
```

## Architecture

- **Complete Separation**: Client and server are completely independent projects
- **Shared Types**: Type definitions in `shared/types/` are used by both projects
- **No Cross-Imports**: Client never imports server code, server never imports client code
- **Independent Builds**: Each project has its own build process and dependencies
