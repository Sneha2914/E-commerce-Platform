# User Service Implementation Steps

This document provides detailed step-by-step instructions for implementing the User Service microservice.

## Technology Stack

- **Framework**: Node.js + Express
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Testing**: Jest
- **Containerization**: Docker

## Prerequisites

- Node.js (v14+) and npm installed
- MongoDB installed locally or accessible MongoDB instance
- Docker installed (for containerization)
- Git for version control

## Implementation Steps

### 1. Project Setup

1. Create a new directory and initialize the Node.js project:
```bash
mkdir user-service
cd user-service
npm init -y
```

2. Install the required dependencies:
```bash
npm install express mongoose bcryptjs jsonwebtoken cors helmet dotenv
npm install --save-dev nodemon jest supertest
```

3. Create the basic project structure:
```bash
mkdir -p src/models src/controllers src/routes src/middleware src/config src/utils
touch .env .gitignore Dockerfile docker-compose.yml
```

4. Set up `.gitignore`:
```
node_modules/
.env
coverage/
.DS_Store
```

5. Create a basic `.env` file:
```
PORT=8081
MONGODB_URI=mongodb://localhost:27017/userdb
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=24h
```

### 2. Database Configuration

1. Create the MongoDB connection file in `src/config/database.js`:
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### 3. User Model

1. Create the user model in `src/models/user.model.js`:
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
```

### 4. Authentication Middleware

1. Create the JWT authentication middleware in `src/middleware/auth.middleware.js`:
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      next();
    });
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = { auth, adminAuth };
```

### 5. User Controller

1. Create the user controller in `src/controllers/user.controller.js`:
```javascript
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRATION
  });
};

// Register a new user
exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      role: role || 'user'
    });
    
    // Remove password from response
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Validate password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    // Create user response without password
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    res.status(200).json({ token, user: userResponse });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { username, email, role } = req.body;
    const userId = req.params.id;
    
    // Check if user exists
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Ensure users can only update their own info unless they're admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update user
    user = await User.findByIdAndUpdate(
      userId,
      { username, email, role },
      { new: true }
    ).select('-password');
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Ensure users can only delete their own account unless they're admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
```

### 6. User Routes

1. Create user routes in `src/routes/user.routes.js`:
```javascript
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { auth, adminAuth } = require('../middleware/auth.middleware');

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Protected routes
router.get('/:id', auth, userController.getUserById);
router.put('/:id', auth, userController.updateUser);
router.delete('/:id', auth, userController.deleteUser);

module.exports = router;
```

### 7. Server Setup

1. Create the main server file in `src/server.js`:
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', require('./routes/user.routes'));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
```

### 8. Update package.json Scripts

1. Update the scripts section in `package.json`:
```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  "test": "jest --detectOpenHandles"
}
```

### 9. Dockerization

1. Create a `Dockerfile`:
```Dockerfile
FROM node:14-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8081

CMD ["npm", "start"]
```

2. Create a `docker-compose.yml` for local development:
```yaml
version: '3'

services:
  user-service:
    build: .
    ports:
      - "8081:8081"
    environment:
      - PORT=8081
      - MONGODB_URI=mongodb://mongo:27017/userdb
      - JWT_SECRET=your_jwt_secret_key
      - JWT_EXPIRATION=24h
    depends_on:
      - mongo
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules
    networks:
      - app-network

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  mongo-data:
```

### 10. Basic Testing Setup

1. Create a simple test file in `src/tests/user.test.js`:
```javascript
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');

describe('User API', () => {
  beforeAll(async () => {
    // Clear the database before tests
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Disconnect mongoose after tests
    await mongoose.connection.close();
  });

  describe('POST /api/users/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.username).toEqual('testuser');
    });
  });

  describe('POST /api/users/login', () => {
    it('should login an existing user', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toEqual('test@example.com');
    });
  });
});
```

### 11. Create Kubernetes Manifests

1. Create a directory for Kubernetes configuration:
```bash
mkdir -p kubernetes
```

2. Create a deployment manifest in `kubernetes/user-service-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: user-service:1.0
        ports:
        - containerPort: 8081
        env:
        - name: PORT
          value: "8081"
        - name: MONGODB_URI
          valueFrom:
            configMapKeyRef:
              name: db-config
              key: user-db-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt-secret
        - name: JWT_EXPIRATION
          value: "24h"
```

3. Create a service manifest in `kubernetes/user-service-service.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
  - port: 8081
    targetPort: 8081
  type: ClusterIP
```

### 12. Run and Test

1. Start the service locally:
```bash
npm run dev
```

2. Test the API endpoints using Postman or curl:
```bash
# Register a new user
curl -X POST \
  http://localhost:8081/api/users/register \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'

# Login
curl -X POST \
  http://localhost:8081/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

3. Run using Docker Compose:
```bash
docker-compose up -d
```

## Deployment

### Build and Deploy with Docker

1. Build the Docker image:
```bash
docker build -t user-service:1.0 .
```

2. Run the container:
```bash
docker run -p 8081:8081 -e MONGODB_URI=mongodb://host.docker.internal:27017/userdb -e JWT_SECRET=your_jwt_secret_key user-service:1.0
```

### Deploy to Kubernetes (Minikube)

1. Load the Docker image into Minikube:
```bash
minikube image load user-service:1.0
```

2. Create secrets and config maps:
```bash
kubectl create secret generic app-secrets --from-literal=jwt-secret=your_jwt_secret_key
```

3. Apply the Kubernetes manifests:
```bash
kubectl apply -f kubernetes/user-service-deployment.yaml
kubectl apply -f kubernetes/user-service-service.yaml
```

4. Verify the deployment:
```bash
kubectl get pods
kubectl get services
``` 