# User Service

A microservice component of the E-Commerce platform responsible for user management, authentication, and authorization.

## Overview

The User Service provides:

-   User registration and authentication
-   User profile management
-   Role-based access control
-   User statistics and analytics
-   Service-to-service user verification

## Prerequisites

-   Node.js 14 or higher
-   MongoDB 4.4 or higher
-   Docker and Docker Compose
-   Kubernetes cluster (for production)

## Quick Start

1. **Clone the Repository**

    ```bash
    git clone https://github.com/your-org/user-service.git
    cd user-service
    ```

2. **Install Dependencies**

    ```bash
    npm install
    ```

3. **Environment Setup**
   Create a `.env` file:

    ```env
    PORT=8081
    MONGODB_URI=mongodb://localhost:27017/userdb
    JWT_SECRET=your_jwt_secret
    NODE_ENV=development
    ```

4. **Start the Service**

    ```bash
    # Development
    npm run dev

    # Production
    npm start
    ```

## Deployment

### Docker Deployment

1. **Build the Image**

    ```bash
    docker build -t user-service:1.0 .
    ```

2. **Run the Container**
    ```bash
    docker run -p 8081:8081 \
      -e MONGODB_URI=mongodb://mongodb:27017/userdb \
      -e JWT_SECRET=your_jwt_secret \
      user-service:1.0
    ```

### Kubernetes Deployment

1. **Create Namespace**

    ```bash
    kubectl create namespace ecommerce
    ```

2. **Apply Kubernetes Manifests**

    ```bash
    kubectl apply -f kubernetes/
    ```

3. **Verify Deployment**
    ```bash
    kubectl get all -n ecommerce -l app=user-service
    ```

## API Documentation

### Public Routes

-   `POST /api/users/register` - Register a new user
-   `POST /api/users/login` - User login

### Protected User Routes

-   `GET /api/users/profile` - Get user profile
-   `PUT /api/users/profile` - Update user profile
-   `DELETE /api/users/profile` - Delete user account

### Admin Routes

-   `GET /api/users` - Get all users
-   `GET /api/users/admin/stats` - Get user statistics
-   `GET /api/users/:id` - Get user by ID
-   `PUT /api/users/:id` - Update user
-   `DELETE /api/users/:id` - Delete user

### Internal Service Routes

-   `GET /api/users/internal/:id` - Get user by ID (service-to-service)

## User Model

### User Fields

-   `username` - Unique username (required)
-   `email` - Unique email address (required, lowercase)
-   `password` - Hashed password (required)
-   `role` - User role (enum: 'user', 'admin', default: 'user')
-   `createdAt` - Account creation timestamp

### Features

-   Password hashing using bcrypt
-   Email and username uniqueness validation
-   Role-based access control
-   Automatic timestamp for creation date
-   Input validation and trimming

## Security Features

-   Password hashing with bcrypt
-   JWT-based authentication
-   Service token validation
-   Role-based authorization
-   Request logging with request IDs
-   CORS configuration
-   Helmet security headers
-   Custom body parser for auth routes
-   Rate limiting (configurable)

## Monitoring

-   Health check endpoints:
    -   `/health`
    -   `/api/health`
-   Request logging with request IDs
-   Detailed error tracking
-   Server timeout configuration (120s)
-   Graceful shutdown handling

## Troubleshooting

### Common Issues

1. Database Connection Issues

    - Check MongoDB connection string
    - Verify MongoDB service is running
    - Check network connectivity

2. Authentication Issues

    - Verify JWT secret configuration
    - Check service token validation
    - Verify user token extraction

3. Performance Issues
    - Check request payload size (limit: 10MB)
    - Monitor server timeouts
    - Check MongoDB query performance

### Debug Commands

```bash
# Check pod status
kubectl get pods -n ecommerce -l app=user-service

# Check service logs
kubectl logs -f deployment/user-service -n ecommerce

# Check MongoDB connection
kubectl exec -it deployment/user-service -n ecommerce -- mongosh

# Check service health
curl http://localhost:8081/health
```

## License

MIT License
