# ExamSeva: AI-Powered Exam Preparation & Resource Management

ExamSeva is a modern web application designed for students to automate and streamline their exam preparation journey. It provides a centralized ecosystem for study materials, AI-powered question analysis, and collaborative discussions.

## Project Structure
- root: General documentation and build configuration.
- /backend: Node.js and Express API server with MongoDB integration.
- /frontend: React.js user interface with a premium design system.
- /python_ai: Flask microservice for document processing and OCR analysis.

## Key Features
- AI question extraction from uploaded document files (PDF/Word).
- Automated Quiz Generation based on the analyzed question papers.
- Integrated Study Hub for subject-wise resource management.
- Real-time Forum with instant notifications for community doube-solving.
- Secure Admin Panel for system monitoring and resource moderation.

## Running the Application
To run the full ExamSeva project locally, please follow these steps:

### 1. Database Setup
- Ensure MongoDB is installed and running on your system.
- The default connection is mongodb://127.0.0.1:27017/examsevaDB.

### 2. Backend Server
- Open a terminal and navigate to the /backend folder.
- Run 'npm install' to install dependencies.
- Create a .env file based on the env.example provided.
- Run 'npm run dev' to start the backend.

### 3. AI Service (Python)
- Open a second terminal and navigate to the /python_ai folder.
- If using a virtual environment, activate it (e.g., venv\Scripts\activate).
- Run 'pip install -r requirements.txt' to install dependencies.
- Run 'python app.py' to start the AI microservice on port 5000.

### 4. Frontend (React)
- Open a third terminal and navigate to the /frontend folder.
- Run 'npm install' to install dependencies.
- Run 'npm start' to launch the web interface on port 3000.

Support documents for the project are available in the root directory: VIVA_PREP_EXAMSEVA.md and PPT_SLIDES_CONTENT.md.
