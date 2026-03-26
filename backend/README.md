# ExamSeva Backend

This is the backend service for the ExamSeva application. It handles authentication, data persistence, file management, and coordination with the AI service.

## Technology Stack
- Node.js (Runtime environment)
- Express.js (Web framework)
- MongoDB (Database)
- Mongoose (Database modeling)
- Socket.io (Real-time updates)
- JWT (Secure authentication)

## Key Features
- Secure Authentication: Password hashing with bcrypt and session management via JSON Web Tokens.
- Notification System: Real-time broadcast of forum posts and study materials.
- Study Hub Management: Handling file uploads, subject categorization, and document retrieval.
- Quiz Logic: Management of user scores and test history.
- AI Integration: Routing document data to the Python AI service for analysis.

## Setup Instructions
1. Navigate to the backend directory.
2. Run 'npm install' to install dependencies.
3. Configure the .env file with your database URI, JWT secret, and SMTP settings.
4. Run 'npm run dev' to start the server in development mode.
